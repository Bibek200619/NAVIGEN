from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies import (
    get_mission_service,
    require_authenticated,
    require_operator,
)
from app.core.constants import MissionStatus
from app.core.security import CurrentUser
from app.schemas.common import Page
from app.schemas.mission import (
    MissionCreate,
    MissionDetailResponse,
    MissionGoalCreate,
    MissionGoalResponse,
    MissionResponse,
    MissionUpdate,
)
from app.services.mission_service import MissionService

router = APIRouter()


@router.get("", response_model=Page[MissionResponse])
async def list_missions(
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    service: Annotated[MissionService, Depends(get_mission_service)],
    robot_id: UUID | None = None,
    mission_status: Annotated[MissionStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[MissionResponse]:
    return await service.list_missions(
        robot_id=robot_id,
        status=mission_status,
        limit=limit,
        offset=offset,
    )


@router.post("", response_model=MissionDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_mission(
    request: MissionCreate,
    user: Annotated[CurrentUser, Depends(require_operator)],
    service: Annotated[MissionService, Depends(get_mission_service)],
) -> MissionDetailResponse:
    return await service.create(request, created_by=user.user_id)


@router.get("/{mission_id}", response_model=MissionDetailResponse)
async def get_mission(
    mission_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    service: Annotated[MissionService, Depends(get_mission_service)],
) -> MissionDetailResponse:
    return await service.get(mission_id)


@router.patch("/{mission_id}", response_model=MissionResponse)
async def update_mission(
    mission_id: UUID,
    request: MissionUpdate,
    _: Annotated[CurrentUser, Depends(require_operator)],
    service: Annotated[MissionService, Depends(get_mission_service)],
) -> MissionResponse:
    return await service.update(mission_id, request)


@router.get("/{mission_id}/goals", response_model=list[MissionGoalResponse])
async def list_mission_goals(
    mission_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    service: Annotated[MissionService, Depends(get_mission_service)],
) -> list[MissionGoalResponse]:
    return await service.list_goals(mission_id)


@router.post(
    "/{mission_id}/goals",
    response_model=MissionGoalResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_mission_goal(
    mission_id: UUID,
    request: MissionGoalCreate,
    _: Annotated[CurrentUser, Depends(require_operator)],
    service: Annotated[MissionService, Depends(get_mission_service)],
) -> MissionGoalResponse:
    return await service.create_goal(mission_id, request)
