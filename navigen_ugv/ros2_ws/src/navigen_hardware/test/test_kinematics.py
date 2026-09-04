import pytest

from navigen_hardware.kinematics import (
    DiffDriveKinematics,
    KinematicsConfig,
    MotionCommandLimiter,
)


CONFIG = KinematicsConfig(
    wheel_radius=0.0625,
    track_width=0.34,
    max_linear_velocity=0.4,
    max_angular_velocity=1.0,
    max_wheel_velocity=0.6,
)


def test_straight_rotation_and_round_trip() -> None:
    kinematics = DiffDriveKinematics(CONFIG)
    assert kinematics.twist_to_wheels(0.3, 0.0) == pytest.approx((0.3, 0.3))
    assert kinematics.twist_to_wheels(0.0, 1.0) == pytest.approx((-0.17, 0.17))
    wheels = kinematics.twist_to_wheels(0.2, 0.5)
    assert kinematics.wheels_to_twist(*wheels) == pytest.approx((0.2, 0.5))


def test_body_and_wheel_limits_preserve_curvature() -> None:
    kinematics = DiffDriveKinematics(CONFIG)
    assert kinematics.twist_to_wheels(5.0, 0.0) == pytest.approx((0.4, 0.4))

    fast = DiffDriveKinematics(
        KinematicsConfig(0.0625, 0.34, 1.0, 4.0, 0.5)
    )
    left, right = fast.twist_to_wheels(0.6, 2.0)
    linear, angular = fast.wheels_to_twist(left, right)
    assert max(abs(left), abs(right)) == pytest.approx(0.5)
    assert linear / angular == pytest.approx(0.6 / 2.0)


def test_non_finite_and_invalid_configuration_are_rejected() -> None:
    kinematics = DiffDriveKinematics(CONFIG)
    with pytest.raises(ValueError):
        kinematics.twist_to_wheels(float('nan'), 0.0)
    with pytest.raises(ValueError):
        kinematics.wheels_to_twist(0.0, float('inf'))
    with pytest.raises(ValueError):
        DiffDriveKinematics(KinematicsConfig(0.0, 0.34))


def test_motion_limiter_bounds_acceleration_and_supports_immediate_stop() -> None:
    limiter = MotionCommandLimiter(
        DiffDriveKinematics(CONFIG),
        max_linear_acceleration=0.8,
        max_angular_acceleration=2.0,
    )
    assert limiter.step(0.4, 0.0, 0.1) == pytest.approx((0.08, 0.08))
    assert limiter.step(0.4, 0.0, 0.1) == pytest.approx((0.16, 0.16))
    assert limiter.reset() == (0.0, 0.0)
    assert limiter.step(-0.4, 0.0, 0.1) == pytest.approx((-0.08, -0.08))
