from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.core.constants import LogLevel, UserRole
from app.core.types import JsonValue
from app.schemas.common import APIModel, require_aware


class SystemLogResponse(APIModel):
    id: UUID
    robot_id: UUID | None = None
    mission_id: UUID | None = None
    level: LogLevel
    source: str
    event_code: str | None = None
    message: str
    context: dict[str, JsonValue] = Field(default_factory=dict)
    recorded_at: datetime
    created_at: datetime

    _aware_recorded = field_validator("recorded_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)


class UserRoleUpdate(APIModel):
    role: UserRole


class UserRoleResponse(APIModel):
    id: UUID
    user_id: UUID
    role: UserRole
    created_at: datetime
    updated_at: datetime

    _aware_created = field_validator("created_at")(require_aware)
    _aware_updated = field_validator("updated_at")(require_aware)
