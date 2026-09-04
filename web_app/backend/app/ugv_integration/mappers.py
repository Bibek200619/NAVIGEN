import math
from collections.abc import Mapping
from datetime import UTC, datetime
from uuid import UUID

from app.core.constants import ConnectionStatus, LocalizationState, SafetyState
from app.core.types import JsonValue
from app.schemas.command import SetGoalPayload
from app.schemas.telemetry import MotorTelemetry, RobotTelemetryResponse

SAFETY_STATE_MAP = {
    0: SafetyState.OK,
    1: SafetyState.WARNING,
    2: SafetyState.EMERGENCY_STOP,
}
LOCALIZATION_STATE_MAP = {
    0: LocalizationState.INITIALIZING,
    1: LocalizationState.TRACKING,
    2: LocalizationState.LOST,
    3: LocalizationState.RELOCALIZING,
}


def map_safety_state(value: int) -> SafetyState:
    try:
        return SAFETY_STATE_MAP[value]
    except KeyError as exc:
        raise ValueError(f"unknown UGV safety state: {value}") from exc


def map_localization_state(value: int) -> LocalizationState:
    try:
        return LOCALIZATION_STATE_MAP[value]
    except KeyError as exc:
        raise ValueError(f"unknown UGV localization state: {value}") from exc


def ros_timestamp(message: Mapping[str, object], fallback: datetime | None = None) -> datetime:
    header = message.get("header")
    if isinstance(header, Mapping):
        stamp = header.get("stamp")
        if isinstance(stamp, Mapping):
            seconds = stamp.get("sec", stamp.get("secs"))
            nanoseconds = stamp.get("nanosec", stamp.get("nsecs", 0))
            if isinstance(seconds, int) and isinstance(nanoseconds, int):
                return datetime.fromtimestamp(seconds + nanoseconds / 1_000_000_000, tz=UTC)
    return fallback or datetime.now(UTC)


def map_motor_telemetry(
    robot_id: UUID, message: Mapping[str, object], *, received_at: datetime | None = None
) -> MotorTelemetry:
    received = received_at or datetime.now(UTC)
    fields = {
        "left_velocity",
        "right_velocity",
        "left_setpoint",
        "right_setpoint",
        "left_pwm",
        "right_pwm",
        "left_ticks",
        "right_ticks",
        "battery_voltage",
        "ultrasonic_left",
        "ultrasonic_right",
        "estop_active",
        "watchdog_triggered",
        "configuration_valid",
        "serial_connected",
        "acknowledged_command_sequence",
        "command_age",
        "rx_crc_errors",
    }
    missing = sorted(fields.difference(message))
    if missing:
        raise ValueError(f"motor telemetry is missing fields: {', '.join(missing)}")
    payload: dict[str, object] = {key: message[key] for key in fields}
    payload.update(
        robot_id=robot_id,
        recorded_at=ros_timestamp(message, received),
        received_at=received,
    )
    return MotorTelemetry.model_validate(payload)


def map_safety_event(
    robot_id: UUID, message: Mapping[str, object], *, received_at: datetime | None = None
) -> dict[str, JsonValue]:
    received = received_at or datetime.now(UTC)
    triggers = message.get("active_triggers", [])
    if not isinstance(triggers, list) or not all(isinstance(item, str) for item in triggers):
        raise ValueError("active_triggers must be a list of strings")
    state = message.get("state")
    if not isinstance(state, int):
        raise ValueError("safety state must be an integer")
    description = message.get("description")
    if description is not None and not isinstance(description, str):
        raise ValueError("safety description must be a string")
    return {
        "robot_id": str(robot_id),
        "recorded_at": ros_timestamp(message, received).isoformat(),
        "received_at": received.isoformat(),
        "state": map_safety_state(state).value,
        "active_triggers": triggers,
        "description": description,
    }


def map_localization_status(
    robot_id: UUID, message: Mapping[str, object], *, received_at: datetime | None = None
) -> dict[str, JsonValue]:
    received = received_at or datetime.now(UTC)
    state = message.get("state")
    features = message.get("tracked_features")
    if not isinstance(state, int) or not isinstance(features, int) or features < 0:
        raise ValueError("invalid localization payload")
    return {
        "robot_id": str(robot_id),
        "recorded_at": ros_timestamp(message, received).isoformat(),
        "received_at": received.isoformat(),
        "state": map_localization_state(state).value,
        "tracked_features": features,
    }


def map_odometry(
    robot_id: UUID,
    message: Mapping[str, object],
    *,
    received_at: datetime | None = None,
    battery_level_pct: float | None = None,
    safety_state: SafetyState | None = None,
    localization_state: LocalizationState | None = None,
) -> RobotTelemetryResponse:
    received = received_at or datetime.now(UTC)
    recorded = ros_timestamp(message, received)
    pose_wrapper = message.get("pose")
    twist_wrapper = message.get("twist")
    pose = pose_wrapper.get("pose") if isinstance(pose_wrapper, Mapping) else None
    twist = twist_wrapper.get("twist") if isinstance(twist_wrapper, Mapping) else None
    if not isinstance(pose, Mapping) or not isinstance(twist, Mapping):
        raise ValueError("odometry payload must contain pose.pose and twist.twist")
    position = pose.get("position")
    orientation = pose.get("orientation")
    linear = twist.get("linear")
    angular = twist.get("angular")
    if not all(isinstance(item, Mapping) for item in (position, orientation, linear, angular)):
        raise ValueError("odometry vectors are malformed")
    assert isinstance(position, Mapping)
    assert isinstance(orientation, Mapping)
    assert isinstance(linear, Mapping)
    assert isinstance(angular, Mapping)
    qx, qy, qz, qw = (
        float(orientation.get("x", 0)),
        float(orientation.get("y", 0)),
        float(orientation.get("z", 0)),
        float(orientation.get("w", 1)),
    )
    yaw = math.atan2(2 * (qw * qz + qx * qy), 1 - 2 * (qy * qy + qz * qz))
    age_ms = max(0, int((received - recorded).total_seconds() * 1000))
    return RobotTelemetryResponse(
        robot_id=robot_id,
        recorded_at=recorded,
        received_at=received,
        connection_status=ConnectionStatus.CONNECTED,
        is_stale=False,
        data_age_ms=age_ms,
        position_x=float(position.get("x", 0)),
        position_y=float(position.get("y", 0)),
        position_z=float(position.get("z", 0)),
        yaw=yaw,
        linear_velocity=float(linear.get("x", 0)),
        angular_velocity=float(angular.get("z", 0)),
        battery_level_pct=battery_level_pct,
        safety_state=safety_state,
        localization_state=localization_state,
    )


def goal_to_ros_message(
    payload: SetGoalPayload, *, stamp: datetime | None = None
) -> dict[str, JsonValue]:
    timestamp = stamp or datetime.now(UTC)
    seconds = int(timestamp.timestamp())
    nanoseconds = timestamp.microsecond * 1000
    return {
        "header": {
            "stamp": {"sec": seconds, "nanosec": nanoseconds},
            "frame_id": payload.frame_id,
        },
        "pose": {
            "position": payload.position.model_dump(),
            "orientation": payload.orientation.model_dump(),
        },
    }
