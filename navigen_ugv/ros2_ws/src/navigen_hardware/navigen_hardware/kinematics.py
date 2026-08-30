"""Pure differential-drive kinematics and command limiting for the 4WD UGV."""

from __future__ import annotations

from dataclasses import dataclass
import math


def clamp(value: float, low: float, high: float) -> float:
    """Clamp a finite scalar to an inclusive range."""
    return max(low, min(high, value))


@dataclass(frozen=True)
class KinematicsConfig:
    """Physical geometry and conservative motion limits."""

    wheel_radius: float
    track_width: float
    max_linear_velocity: float = 0.4
    max_angular_velocity: float = 1.0
    max_wheel_velocity: float = 0.6

    def validate(self) -> None:
        values = (
            self.wheel_radius,
            self.track_width,
            self.max_linear_velocity,
            self.max_angular_velocity,
            self.max_wheel_velocity,
        )
        if not all(math.isfinite(value) and value > 0.0 for value in values):
            raise ValueError('geometry and velocity limits must be finite and positive')


class DiffDriveKinematics:
    """Convert body velocity to left/right wheel-surface velocity and back."""

    def __init__(self, config: KinematicsConfig):
        config.validate()
        self.config = config

    def twist_to_wheels(self, linear_x: float, angular_z: float) -> tuple[float, float]:
        if not (math.isfinite(linear_x) and math.isfinite(angular_z)):
            raise ValueError('twist command must be finite')
        cfg = self.config
        linear = clamp(linear_x, -cfg.max_linear_velocity, cfg.max_linear_velocity)
        angular = clamp(angular_z, -cfg.max_angular_velocity, cfg.max_angular_velocity)
        left = linear - angular * cfg.track_width / 2.0
        right = linear + angular * cfg.track_width / 2.0

        peak = max(abs(left), abs(right))
        if peak > cfg.max_wheel_velocity:
            scale = cfg.max_wheel_velocity / peak
            left *= scale
            right *= scale
        return left, right

    def wheels_to_twist(self, left: float, right: float) -> tuple[float, float]:
        if not (math.isfinite(left) and math.isfinite(right)):
            raise ValueError('wheel velocity must be finite')
        return (left + right) / 2.0, (right - left) / self.config.track_width

    def ticks_to_distance(self, delta_ticks: float, ticks_per_revolution: float) -> float:
        if not math.isfinite(delta_ticks):
            raise ValueError('encoder delta must be finite')
        if not math.isfinite(ticks_per_revolution) or ticks_per_revolution <= 0.0:
            raise ValueError('ticks_per_revolution must be finite and positive')
        return (
            delta_ticks / ticks_per_revolution
            * 2.0 * math.pi * self.config.wheel_radius
        )

    def ticks_to_velocity(
        self, delta_ticks: float, dt: float, ticks_per_revolution: float
    ) -> float:
        if not math.isfinite(dt) or dt <= 0.0:
            raise ValueError('dt must be finite and positive')
        return self.ticks_to_distance(delta_ticks, ticks_per_revolution) / dt


class MotionCommandLimiter:
    """Apply body limits, acceleration limits, then curvature-preserving wheel limits."""

    def __init__(
        self,
        kinematics: DiffDriveKinematics,
        max_linear_acceleration: float,
        max_angular_acceleration: float,
    ):
        if not (
            math.isfinite(max_linear_acceleration)
            and max_linear_acceleration > 0.0
            and math.isfinite(max_angular_acceleration)
            and max_angular_acceleration > 0.0
        ):
            raise ValueError('acceleration limits must be finite and positive')
        self.kinematics = kinematics
        self.max_linear_acceleration = max_linear_acceleration
        self.max_angular_acceleration = max_angular_acceleration
        self.linear = 0.0
        self.angular = 0.0

    def reset(self) -> tuple[float, float]:
        """Stop immediately; used for stale, invalid, and e-stop conditions."""
        self.linear = 0.0
        self.angular = 0.0
        return 0.0, 0.0

    def step(self, linear_x: float, angular_z: float, dt: float) -> tuple[float, float]:
        if not (
            math.isfinite(linear_x)
            and math.isfinite(angular_z)
            and math.isfinite(dt)
            and dt > 0.0
        ):
            raise ValueError('motion command and dt must be finite; dt must be positive')

        cfg = self.kinematics.config
        target_linear = clamp(
            linear_x, -cfg.max_linear_velocity, cfg.max_linear_velocity
        )
        target_angular = clamp(
            angular_z, -cfg.max_angular_velocity, cfg.max_angular_velocity
        )
        linear_delta = self.max_linear_acceleration * dt
        angular_delta = self.max_angular_acceleration * dt
        self.linear += clamp(target_linear - self.linear, -linear_delta, linear_delta)
        self.angular += clamp(target_angular - self.angular, -angular_delta, angular_delta)
        return self.kinematics.twist_to_wheels(self.linear, self.angular)
