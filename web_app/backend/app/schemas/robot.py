from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator

from app.core.constants import ConnectionStatus, RobotStatus
from app.core.types import JsonValue
from app.schemas.common import APIModel, require_aware


class RobotResponse(APIModel):
    id: UUID
    name: str
    slug: str
    status: RobotStatus
    connection_status: ConnectionStatus
    last_seen_at: datetime | None = None
    description: str | None = None
    metadata: dict[str, JsonValue] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

    _aware_last_seen = field_validator("last_seen_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)
    _aware_updated = field_validator("updated_at")(require_aware)
