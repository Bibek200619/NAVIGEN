from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.core.constants import SCHEMA_VERSION, WebSocketEventType
from app.core.types import JsonValue
from app.schemas.common import APIModel


class WebSocketEvent(APIModel):
    schema_version: int = SCHEMA_VERSION
    event_type: WebSocketEventType
    robot_id: UUID | None = None
    recorded_at: datetime
    received_at: datetime
    payload: dict[str, JsonValue] = Field(default_factory=dict)
