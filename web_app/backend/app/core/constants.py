from enum import StrEnum

SCHEMA_VERSION = 1
API_VERSION = "1"
SERVICE_NAME = "navigen-backend"


class UserRole(StrEnum):
    ADMIN = "admin"
    OPERATOR = "operator"
    VIEWER = "viewer"


class RobotStatus(StrEnum):
    IDLE = "idle"
    NAVIGATING = "navigating"
    MANUAL = "manual"
    OFFLINE = "offline"
    ERROR = "error"


class ConnectionStatus(StrEnum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"


class MissionStatus(StrEnum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    ABORTED = "aborted"


class CommandStatus(StrEnum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"


class CommandType(StrEnum):
    SET_GOAL = "set_goal"
    SOFTWARE_ESTOP = "software_estop"


class SafetyState(StrEnum):
    OK = "ok"
    WARNING = "warning"
    EMERGENCY_STOP = "emergency_stop"


class LocalizationState(StrEnum):
    INITIALIZING = "initializing"
    TRACKING = "tracking"
    LOST = "lost"
    RELOCALIZING = "relocalizing"


class LogLevel(StrEnum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class WebSocketEventType(StrEnum):
    ROBOT_TELEMETRY = "robot.telemetry"
    ROBOT_CONNECTION = "robot.connection"
    MOTOR_TELEMETRY = "motor.telemetry"
    SAFETY_CHANGED = "safety.changed"
    LOCALIZATION_CHANGED = "localization.changed"
    SENSOR_STATUS = "sensor.status"
    MISSION_CREATED = "mission.created"
    MISSION_UPDATED = "mission.updated"
    COMMAND_UPDATED = "command.updated"
    SYSTEM_ALERT = "system.alert"


TERMINAL_MISSION_STATUSES = frozenset(
    {MissionStatus.COMPLETED, MissionStatus.FAILED, MissionStatus.ABORTED}
)

MISSION_TRANSITIONS: dict[MissionStatus, frozenset[MissionStatus]] = {
    MissionStatus.PENDING: frozenset(
        {MissionStatus.IN_PROGRESS, MissionStatus.FAILED, MissionStatus.ABORTED}
    ),
    MissionStatus.IN_PROGRESS: frozenset(
        {MissionStatus.COMPLETED, MissionStatus.FAILED, MissionStatus.ABORTED}
    ),
    MissionStatus.COMPLETED: frozenset(),
    MissionStatus.FAILED: frozenset(),
    MissionStatus.ABORTED: frozenset(),
}
