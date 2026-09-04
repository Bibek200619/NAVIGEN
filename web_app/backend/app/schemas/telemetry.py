from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.core.constants import ConnectionStatus, LocalizationState, SafetyState
from app.core.types import JsonValue
from app.schemas.common import APIModel, require_aware


class RobotTelemetryResponse(APIModel):
    id: UUID | None = None
    robot_id: UUID
    recorded_at: datetime
    received_at: datetime
    connection_status: ConnectionStatus
    is_stale: bool
    data_age_ms: int = Field(ge=0)
    position_x: float | None = None
    position_y: float | None = None
    position_z: float | None = None
    yaw: float | None = None
    linear_velocity: float | None = None
    angular_velocity: float | None = None
    battery_level_pct: float | None = Field(default=None, ge=0, le=100)
    safety_state: SafetyState | None = None
    localization_state: LocalizationState | None = None
    created_at: datetime | None = None

    _aware_recorded = field_validator("recorded_at")(require_aware)
    _aware_received = field_validator("received_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)


class MotorTelemetry(APIModel):
    robot_id: UUID
    recorded_at: datetime
    received_at: datetime
    left_velocity: float
    right_velocity: float
    left_setpoint: float
    right_setpoint: float
    left_pwm: int
    right_pwm: int
    left_ticks: int
    right_ticks: int
    battery_voltage: float
    ultrasonic_left: float
    ultrasonic_right: float
    estop_active: bool
    watchdog_triggered: bool
    configuration_valid: bool
    serial_connected: bool
    acknowledged_command_sequence: int = Field(ge=0, le=65535)
    command_age: float = Field(ge=0)
    rx_crc_errors: int = Field(ge=0)

    _aware_recorded = field_validator("recorded_at")(require_aware)
    _aware_received = field_validator("received_at")(require_aware)


class SafetyEventResponse(APIModel):
    id: UUID | None = None
    robot_id: UUID
    recorded_at: datetime
    received_at: datetime
    state: SafetyState
    active_triggers: list[str]
    description: str | None = None
    created_at: datetime | None = None

    _aware_recorded = field_validator("recorded_at")(require_aware)
    _aware_received = field_validator("received_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)


class LocalizationStatusResponse(APIModel):
    id: UUID | None = None
    robot_id: UUID
    recorded_at: datetime
    received_at: datetime
    state: LocalizationState
    tracked_features: int = Field(ge=0)
    created_at: datetime | None = None

    _aware_recorded = field_validator("recorded_at")(require_aware)
    _aware_received = field_validator("received_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)


class SensorStatusResponse(APIModel):
    id: UUID
    robot_id: UUID
    sensor_key: str
    name: str
    topic: str | None = None
    is_active: bool
    frequency_hz: float | None = Field(default=None, ge=0)
    last_updated_at: datetime | None = None
    details: dict[str, JsonValue] = Field(default_factory=dict)
    updated_at: datetime

    _aware_last_updated = field_validator("last_updated_at")(require_aware)
    _aware_updated = field_validator("updated_at")(require_aware)


class SensorStatusUpsert(APIModel):
    robot_id: UUID
    sensor_key: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    topic: str | None = Field(default=None, max_length=256)
    is_active: bool
    frequency_hz: float | None = Field(default=None, ge=0)
    last_updated_at: datetime | None = None
    details: dict[str, JsonValue] = Field(default_factory=dict)

    _aware_last_updated = field_validator("last_updated_at")(require_aware)
