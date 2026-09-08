"""Deterministic kinematic product demo. No ROS, motors, or production services."""

from collections import deque
from datetime import datetime, timezone
from math import atan, atan2, cos, degrees, hypot, pi, sin
from uuid import uuid4

from environments import PRESETS, START, TerrainConfig, build_environment, height_at
from navigation import ROVER_RADIUS, plan_path, rectangles, segment_clear

ROBOT_ID = "10000000-0000-0000-0000-000000000001"


def now():
    return datetime.now(timezone.utc).isoformat()


class Simulation:
    def __init__(self):
        self.events = deque(maxlen=100)
        self.environment_revision = 0
        self.custom_config = TerrainConfig()
        self.select_environment("mountain")

    def select_environment(self, environment_id, custom=None):
        if environment_id == "custom":
            config = (
                TerrainConfig.model_validate(custom)
                if custom is not None
                else self.custom_config
            )
        elif environment_id in PRESETS:
            config = PRESETS[environment_id]
        else:
            raise ValueError("Choose mountain, rocky, forest, or custom.")
        environment = build_environment(environment_id, config)
        if environment_id == "custom":
            self.custom_config = config
        self.environment = environment
        self.objects = environment["objects"]
        self.waypoints = environment["waypoints"]
        self.environment_revision += 1
        self.reset()
        self.log(f"Environment loaded: {environment['name']}. Ready at base camp.")
        return self.snapshot()

    def ground(self, x, y):
        return height_at(self.environment["config"], x, y)

    def terrain_pose(self):
        forward = (cos(self.yaw), sin(self.yaw))
        right = (-sin(self.yaw), cos(self.yaw))
        front = self.ground(self.x + forward[0] * 0.6, self.y + forward[1] * 0.6)
        back = self.ground(self.x - forward[0] * 0.6, self.y - forward[1] * 0.6)
        left = self.ground(self.x - right[0] * 0.55, self.y - right[1] * 0.55)
        right_height = self.ground(self.x + right[0] * 0.55, self.y + right[1] * 0.55)
        return (
            self.ground(self.x, self.y),
            atan((front - back) / 1.2),
            atan((right_height - left) / 1.1),
        )

    def log(self, message, level="info"):
        self.events.appendleft(
            {
                "id": str(uuid4()),
                "level": level,
                "source": "simulation",
                "message": message,
                "recorded_at": now(),
            }
        )

    def reset(self):
        self.events.clear()
        self.x, self.y = START
        self.yaw = 0.0
        self.linear_velocity = self.angular_velocity = 0.0
        self.status = "idle"
        self.target = 0
        self.distance = 0.0
        self.elapsed = 0.0
        self.battery = 94.0
        self.obstacle = None
        self.estop = False
        self.auto_demo = False
        self.demo_obstacle_shown = False
        self.path = []
        self.detouring = False
        self.trail = [START]
        self.progress = 0.0
        self.log("Simulation reset. Vehicle ready at the base camp.")

    def command(self, action):
        if action == "reset":
            self.reset()
        elif action == "demo":
            self.reset()
            self.auto_demo = True
            self.status = "running"
            self.log(
                "Guided demo started: inspect four waypoints and respond to an obstacle."
            )
        elif action == "start":
            if self.estop:
                raise ValueError(
                    "Reset the simulation to clear the simulated emergency stop."
                )
            if self.status == "completed":
                raise ValueError("Reset the simulation to start a new inspection.")
            if self.status not in ("running", "avoiding", "blocked"):
                self.status = "avoiding" if len(self.path) > 1 else "running"
                self.log(
                    "Inspection mission started."
                    if self.target == 0
                    else "Inspection resumed."
                )
        elif action == "pause":
            if self.status not in ("running", "avoiding", "blocked"):
                raise ValueError("No running inspection to pause.")
            self.status = "paused"
            self.linear_velocity = self.angular_velocity = 0.0
            self.log("Inspection paused by the demo operator.")
        elif action == "obstacle":
            if self.status != "running":
                raise ValueError("Start the inspection before placing an obstacle.")
            if self.obstacle:
                raise ValueError(
                    "Clear the existing test obstacle before adding another."
                )
            self.obstacle = {
                "x": self.x + cos(self.yaw) * 2.8,
                "y": self.y + sin(self.yaw) * 2.8,
                "radius": 0.55,
            }
            self.log("A test obstacle has been placed in the vehicle path.", "warning")
            self.plan_route()
        elif action == "clear_obstacle":
            self.obstacle = None
            self.path = []
            self.detouring = False
            if self.status in ("running", "avoiding", "blocked"):
                self.plan_route()
            self.log("Path cleared. Inspection may continue.")
        elif action == "estop":
            self.estop = True
            self.status = "emergency_stop"
            self.auto_demo = False
            self.linear_velocity = self.angular_velocity = 0.0
            self.log("Simulated emergency stop asserted. Motion halted.", "error")
        else:
            raise ValueError("Unknown simulation command.")
        return self.snapshot()

    def plan_route(self):
        target = self.waypoints[self.target]
        self.path = plan_path(
            (self.x, self.y), (target["x"], target["y"]), self.objects, self.obstacle
        )
        self.detouring = bool(self.path and len(self.path) > 1)
        if self.path is None:
            self.path = []
            self.status = "blocked"
            self.linear_velocity = self.angular_velocity = 0.0
            self.log(
                "No clear detour to the checkpoint. Clear the path to continue.",
                "warning",
            )
        elif len(self.path) > 1:
            self.status = "avoiding"
            self.log(
                "Obstacle detected. Turning around it and rejoining the inspection route."
            )
        else:
            self.status = "running"

    def step(self, dt):
        dt = min(max(dt, 0), 0.1)
        self.linear_velocity = self.angular_velocity = 0.0
        if self.status not in ("running", "avoiding") or self.estop:
            return
        self.elapsed += dt
        if self.auto_demo and self.elapsed > 7 and not self.demo_obstacle_shown:
            if self.obstacle:
                self.demo_obstacle_shown = True
            elif self.status == "running":
                self.command("obstacle")
                self.demo_obstacle_shown = True
        if not self.path and self.status != "blocked":
            self.plan_route()
        if self.status == "blocked":
            return
        target = self.waypoints[self.target]
        dx, dy = self.path[0][0] - self.x, self.path[0][1] - self.y
        distance = hypot(dx, dy)
        if distance < 0.08:
            self.path.pop(0)
            if self.path:
                if len(self.path) == 1:
                    self.log(
                        "Obstacle passed. Rejoining the route to the next checkpoint."
                    )
                    self.status = "running"
                return
            self.detouring = False
            self.x, self.y = target["x"], target["y"]
            self.log(f"Waypoint {self.target + 1} reached: {target['name']}.")
            self.target += 1
            if self.target == len(self.waypoints):
                self.status = "completed"
                self.auto_demo = False
                self.log("Inspection complete. Vehicle returned to base camp.")
            return
        angle = (atan2(dy, dx) - self.yaw + pi) % (2 * pi) - pi
        self.angular_velocity = max(-1.25, min(1.25, angle * 3))
        self.yaw += self.angular_velocity * dt
        _, pitch, roll = self.terrain_pose()
        config = self.environment["config"]
        grip = config["grip"] * (0.78 if config["weather"] == "rain" else 1)
        terrain_speed = (
            2.4
            * grip
            / (1 + abs(pitch) * 1.8 + abs(roll) * 0.8 + config["roughness"] * 0.35)
        )
        self.linear_velocity = (
            min(terrain_speed, distance * 2) * max(0, cos(angle)) ** 2
            if abs(angle) < 0.3
            else 0
        )
        travel = self.linear_velocity * dt
        next_position = (
            self.x + cos(self.yaw) * travel,
            self.y + sin(self.yaw) * travel,
        )
        collision_bounds = rectangles(self.objects, self.obstacle, ROVER_RADIUS)
        if not segment_clear(
            (self.x, self.y),
            next_position,
            collision_bounds,
            ROVER_RADIUS,
        ) or not segment_clear(
            next_position, self.path[0], collision_bounds, ROVER_RADIUS
        ):
            self.linear_velocity = 0.0
            return
        elevation_change = self.ground(*next_position) - self.ground(self.x, self.y)
        self.x, self.y = next_position
        self.distance += hypot(travel, elevation_change)
        self.battery = max(
            20, self.battery - travel * (0.025 + abs(pitch) * 0.06 + (1 - grip) * 0.025)
        )
        if hypot(self.x - self.trail[-1][0], self.y - self.trail[-1][1]) > 0.15:
            self.trail.append((round(self.x, 2), round(self.y, 2)))
            self.trail = self.trail[-500:]

    def telemetry(self):
        elevation, pitch, roll = self.terrain_pose()
        return {
            "connection_status": "connected",
            "is_stale": False,
            "linear_velocity": round(self.linear_velocity, 3),
            "angular_velocity": round(self.angular_velocity, 3),
            "position_x": round(self.x, 3),
            "position_y": round(self.y, 3),
            "position_z": round(elevation, 3),
            "pitch": round(pitch, 4),
            "roll": round(roll, 4),
            "slope_degrees": round(degrees(hypot(pitch, roll)), 1),
            "traction_pct": round(
                self.environment["config"]["grip"]
                * (78 if self.environment["config"]["weather"] == "rain" else 100)
            ),
            "yaw": round(self.yaw, 3),
            "battery_level_pct": round(self.battery, 2),
            "safety_state": "emergency_stop"
            if self.estop
            else "warning"
            if self.status in ("blocked", "avoiding")
            else "ok",
            "localization_state": "tracking",
        }

    def snapshot(self):
        if self.target == len(self.waypoints):
            self.progress = 100.0
        else:
            start = (
                START
                if self.target == 0
                else (
                    self.waypoints[self.target - 1]["x"],
                    self.waypoints[self.target - 1]["y"],
                )
            )
            goal = self.waypoints[self.target]
            dx, dy = goal["x"] - start[0], goal["y"] - start[1]
            fraction = max(
                0,
                min(
                    0.99,
                    ((self.x - start[0]) * dx + (self.y - start[1]) * dy)
                    / (dx * dx + dy * dy),
                ),
            )
            self.progress = max(
                self.progress, (self.target + fraction) / len(self.waypoints) * 100
            )
        return {
            "simulation": True,
            "robot_id": ROBOT_ID,
            "recorded_at": now(),
            "status": self.status,
            "target_index": self.target,
            "waypoints": self.waypoints,
            "distance_m": round(self.distance, 2),
            "elapsed_seconds": round(self.elapsed, 1),
            "progress_pct": round(self.progress, 1),
            "environment": {
                key: value
                for key, value in self.environment.items()
                if key not in ("objects", "waypoints")
            },
            "environment_revision": self.environment_revision,
            "obstacle": self.obstacle,
            "avoidance_path": self.path if self.detouring else [],
            "auto_demo": self.auto_demo,
            "trail": self.trail,
            "objects": self.objects,
            "events": list(self.events)[:12],
            **self.telemetry(),
        }
