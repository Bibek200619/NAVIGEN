from datetime import UTC, datetime
from uuid import uuid4

from app.ugv_integration.mappers import map_localization_status, map_motor_telemetry


def test_motor_telemetry_preserves_canonical_fields() -> None:
    message = {
        "header": {"stamp": {"sec": 10, "nanosec": 500}},
        "left_velocity": 0.1,
        "right_velocity": 0.2,
        "left_setpoint": 0.15,
        "right_setpoint": 0.25,
        "left_pwm": 10,
        "right_pwm": 11,
        "left_ticks": 100,
        "right_ticks": 101,
        "battery_voltage": 12.4,
        "ultrasonic_left": -1.0,
        "ultrasonic_right": 1.5,
        "estop_active": False,
        "watchdog_triggered": False,
        "configuration_valid": True,
        "serial_connected": True,
        "acknowledged_command_sequence": 12,
        "command_age": 0.02,
        "rx_crc_errors": 0,
    }
    mapped = map_motor_telemetry(uuid4(), message, received_at=datetime.now(UTC))
    assert mapped.left_velocity == 0.1
    assert mapped.acknowledged_command_sequence == 12
    assert mapped.ultrasonic_left == -1.0


def test_localization_mapper_preserves_tracked_features() -> None:
    mapped = map_localization_status(
        uuid4(), {"state": 1, "tracked_features": 77}, received_at=datetime.now(UTC)
    )
    assert mapped["state"] == "tracking"
    assert mapped["tracked_features"] == 77
