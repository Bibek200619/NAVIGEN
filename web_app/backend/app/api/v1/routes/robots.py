from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import (
    get_robot_service,
    get_telemetry_service,
    require_authenticated,
)
from app.core.security import CurrentUser
from app.schemas.common import Page
from app.schemas.robot import RobotResponse
from app.schemas.telemetry import (
    LocalizationStatusResponse,
    RobotTelemetryResponse,
    SafetyEventResponse,
    SensorStatusResponse,
)
from app.services.robot_service import RobotService
from app.services.telemetry_service import TelemetryService

router = APIRouter()


@router.get("", response_model=Page[RobotResponse])
async def list_robots(
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    service: Annotated[RobotService, Depends(get_robot_service)],
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[RobotResponse]:
    return await service.list(limit=limit, offset=offset)


@router.get("/{robot_id}", response_model=RobotResponse)
async def get_robot(
    robot_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    service: Annotated[RobotService, Depends(get_robot_service)],
) -> RobotResponse:
    return await service.get(robot_id)


@router.get("/{robot_id}/telemetry", response_model=list[RobotTelemetryResponse])
async def get_robot_telemetry(
    robot_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    robots: Annotated[RobotService, Depends(get_robot_service)],
    telemetry: Annotated[TelemetryService, Depends(get_telemetry_service)],
    from_time: Annotated[datetime | None, Query(alias="from")] = None,
    to_time: Annotated[datetime | None, Query(alias="to")] = None,
    limit: Annotated[int, Query(ge=1, le=1000)] = 200,
) -> list[RobotTelemetryResponse]:
    await robots.get(robot_id)
    return await telemetry.history(
        robot_id, from_time=from_time, to_time=to_time, limit=limit
    )


@router.get("/{robot_id}/safety", response_model=list[SafetyEventResponse])
async def get_robot_safety(
    robot_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    robots: Annotated[RobotService, Depends(get_robot_service)],
    telemetry: Annotated[TelemetryService, Depends(get_telemetry_service)],
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
) -> list[SafetyEventResponse]:
    await robots.get(robot_id)
    return await telemetry.safety_history(robot_id, limit=limit)


@router.get("/{robot_id}/sensors", response_model=list[SensorStatusResponse])
async def get_robot_sensors(
    robot_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    robots: Annotated[RobotService, Depends(get_robot_service)],
    telemetry: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> list[SensorStatusResponse]:
    await robots.get(robot_id)
    return await telemetry.sensor_statuses(robot_id)


@router.get("/{robot_id}/localization", response_model=LocalizationStatusResponse | None)
async def get_robot_localization(
    robot_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    robots: Annotated[RobotService, Depends(get_robot_service)],
    telemetry: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> LocalizationStatusResponse | None:
    await robots.get(robot_id)
    return await telemetry.latest_localization(robot_id)
