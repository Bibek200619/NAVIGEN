import math
from datetime import datetime
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.core.constants import MissionStatus
from app.schemas.common import APIModel, require_aware


class MissionGoalCreate(APIModel):
    sequence_no: int | None = Field(default=None, ge=0)
    frame_id: str = Field(default="map", min_length=1, max_length=128)
    position_x: float
    position_y: float
    position_z: float = 0.0
    orientation_x: float = 0.0
    orientation_y: float = 0.0
    orientation_z: float
    orientation_w: float

    @model_validator(mode="after")
    def validate_pose(self) -> "MissionGoalCreate":
        values = (
            self.position_x,
            self.position_y,
            self.position_z,
            self.orientation_x,
            self.orientation_y,
            self.orientation_z,
            self.orientation_w,
        )
        if not all(math.isfinite(value) for value in values):
            raise ValueError("pose values must be finite")
        norm = math.sqrt(
            self.orientation_x**2
            + self.orientation_y**2
            + self.orientation_z**2
            + self.orientation_w**2
        )
        if not math.isclose(norm, 1.0, rel_tol=1e-4, abs_tol=1e-4):
            raise ValueError("orientation quaternion must be normalized")
        return self


class MissionGoalResponse(APIModel):
    id: UUID
    mission_id: UUID
    sequence_no: int
    frame_id: str
    position_x: float
    position_y: float
    position_z: float
    orientation_x: float
    orientation_y: float
    orientation_z: float
    orientation_w: float
    reached_at: datetime | None = None
    created_at: datetime

    _aware_reached = field_validator("reached_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)


class MissionCreate(APIModel):
    robot_id: UUID
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    goals: list[MissionGoalCreate] = Field(default_factory=list, max_length=500)


class MissionUpdate(APIModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=4000)
    status: MissionStatus | None = None
    failure_reason: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def not_empty(self) -> "MissionUpdate":
        if not self.model_fields_set:
            raise ValueError("at least one field must be supplied")
        return self


class MissionResponse(APIModel):
    id: UUID
    robot_id: UUID
    name: str
    description: str | None = None
    status: MissionStatus
    created_by: UUID
    started_at: datetime | None = None
    completed_at: datetime | None = None
    failure_reason: str | None = None
    created_at: datetime
    updated_at: datetime

    _aware_started = field_validator("started_at")(require_aware)
    _aware_completed = field_validator("completed_at")(require_aware)
    _aware_created = field_validator("created_at")(require_aware)
    _aware_updated = field_validator("updated_at")(require_aware)


class MissionDetailResponse(MissionResponse):
    goals: list[MissionGoalResponse] = Field(default_factory=list)
