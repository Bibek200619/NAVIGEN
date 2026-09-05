"""Deterministic kinematic product demo. No ROS, motors, or production services."""

from collections import deque
from datetime import datetime, timezone
from math import atan2, cos, hypot, pi, sin
from uuid import uuid4

from navigation import ROVER_RADIUS, plan_path, rectangles, segment_clear

ROBOT_ID = "10000000-0000-0000-0000-000000000001"
WAYPOINTS = [
    {"name": "Receiving bay", "x": 7.0, "y": -6.0},
    {"name": "Inspection point", "x": 7.0, "y": 6.0},
    {"name": "Storage aisle", "x": -7.0, "y": 6.0},
    {"name": "Return to dock", "x": -7.0, "y": -6.0},
]
# Shared geometry: [x, y, width, depth, height, color, kind]
OBJECTS = [
    [-3.8, -1.8, 2.4, 2.3, 2.5, "#9ba996", "rack"],
    [0, -1.8, 2.4, 2.3, 2.5, "#9ba996", "rack"],
    [3.8, -1.8, 2.4, 2.3, 2.5, "#9ba996", "rack"],
    [-3.8, 2, 2.4, 2.3, 2.5, "#9ba996", "rack"],
    [0, 2, 2.4, 2.3, 2.5, "#9ba996", "rack"],
    [3.8, 2, 2.4, 2.3, 2.5, "#9ba996", "rack"],
    [-10.4, -2, 1.3, 1.4, 1.1, "#bca67d", "crate"],
    [-10.4, 1, 1.3, 1.4, 1.6, "#bca67d", "crate"],
    [10.4, 1.5, 1.4, 1.8, 1.3, "#bca67d", "crate"],
    [10.4, -2, 1.4, 1.4, 0.8, "#bca67d", "crate"],
]


def now():
    return datetime.now(timezone.utc).isoformat()


class Simulation:
    def __init__(self):
        self.events = deque(maxlen=100)
        self.reset()

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
        self.x, self.y, self.yaw = -7.0, -6.0, 0.0
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
        self.trail = [(-7.0, -6.0)]
        self.log("Simulation reset. Vehicle ready at the charging dock.")

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
        target = WAYPOINTS[self.target]
        self.path = plan_path(
            (self.x, self.y), (target["x"], target["y"]), OBJECTS, self.obstacle
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
            self.command("obstacle")
            self.demo_obstacle_shown = True
        if not self.path and self.status != "blocked":
            self.plan_route()
        if self.status == "blocked":
            return
        target = WAYPOINTS[self.target]
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
            if self.target == len(WAYPOINTS):
                self.status = "completed"
                self.auto_demo = False
                self.log("Inspection complete. Vehicle returned to the dock.")
            return
        angle = (atan2(dy, dx) - self.yaw + pi) % (2 * pi) - pi
        self.angular_velocity = max(-1.25, min(1.25, angle * 3))
        self.yaw += self.angular_velocity * dt
        self.linear_velocity = (
            min(1.2, distance * 2) * max(0, cos(angle)) ** 2 if abs(angle) < 0.3 else 0
        )
        travel = self.linear_velocity * dt
        next_position = (
            self.x + cos(self.yaw) * travel,
            self.y + sin(self.yaw) * travel,
        )
        collision_bounds = rectangles(OBJECTS, self.obstacle, ROVER_RADIUS)
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
        self.x, self.y = next_position
        self.distance += travel
        self.battery = max(20, 94 - self.distance * 0.025)
        if hypot(self.x - self.trail[-1][0], self.y - self.trail[-1][1]) > 0.15:
            self.trail.append((round(self.x, 2), round(self.y, 2)))
            self.trail = self.trail[-500:]

    def telemetry(self):
        return {
            "connection_status": "connected",
            "is_stale": False,
            "linear_velocity": round(self.linear_velocity, 3),
            "angular_velocity": round(self.angular_velocity, 3),
            "position_x": round(self.x, 3),
            "position_y": round(self.y, 3),
            "position_z": 0.0,
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
        return {
            "simulation": True,
            "robot_id": ROBOT_ID,
            "recorded_at": now(),
            "status": self.status,
            "target_index": self.target,
            "waypoints": WAYPOINTS,
            "distance_m": round(self.distance, 2),
            "elapsed_seconds": round(self.elapsed, 1),
            "progress_pct": 100.0
            if self.target == len(WAYPOINTS)
            else round(min(99.9, self.distance / 52 * 100), 1),
            "obstacle": self.obstacle,
            "avoidance_path": self.path if self.detouring else [],
            "auto_demo": self.auto_demo,
            "trail": self.trail,
            "objects": OBJECTS,
            "events": list(self.events)[:12],
            **self.telemetry(),
        }
