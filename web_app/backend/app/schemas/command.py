from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.core.constants import CommandStatus, CommandType
from app.core.types import JsonValue
from app.schemas.common import APIModel, require_aware


class PoseVector(APIModel):
    x: float
    y: float
    z: float


class Quaternion(APIModel):
    x: float
    y: float
    z: float
    w: float


class SetGoalPayload(APIModel):
    frame_id: str = Field(default="map", min_length=1, max_length=128)
    position: PoseVector
    orientation: Quaternion


class SoftwareEstopPayload(APIModel):
    active: bool


class CommandCreate(APIModel):
    mission_id: UUID | None = None
    command_type: CommandType
    payload: dict[str, JsonValue] = Field(default_factory=dict)


class CommandResponse(APIModel):
    id: UUID
    robot_id: UUID
    mission_id: UUID | None = None
    requested_by: UUID
    command_type: CommandType
    status: CommandStatus
    request_payload: dict[str, JsonValue]
    response_payload: dict[str, JsonValue]
    rejection_reason: str | None = None
    failure_reason: str | None = None
    requested_at: datetime
    acknowledged_at: datetime | None = None
    executed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    _aware_requested = field_validator("requested_at")(require_aware)
    _aware_acknowledged = field_validator("acknowledged_at")(require_aware)
    _aware_executed = field_validator("executed_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)
    _aware_updated = field_validator("updated_at")(require_aware)
