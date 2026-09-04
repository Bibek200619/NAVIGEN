from datetime import datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.types import JsonValue

T = TypeVar("T")


class APIModel(BaseModel):
    model_config = ConfigDict(extra="forbid", from_attributes=True)


class Page(APIModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


class ErrorBody(APIModel):
    code: str
    message: str
    details: dict[str, JsonValue] = Field(default_factory=dict)
    request_id: UUID


class ErrorResponse(APIModel):
    error: ErrorBody


def require_aware(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must include a timezone")
    return value


class TimeRange(APIModel):
    from_time: datetime | None = None
    to_time: datetime | None = None

    _aware_from = field_validator("from_time")(require_aware)
    _aware_to = field_validator("to_time")(require_aware)
