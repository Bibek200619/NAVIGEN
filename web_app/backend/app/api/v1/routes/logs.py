from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.dependencies import get_database, require_authenticated
from app.core.constants import LogLevel
from app.core.security import CurrentUser
from app.db.client import SupabaseDatabaseClient
from app.repositories.system_logs import SystemLogRepository
from app.schemas.common import Page
from app.schemas.system import SystemLogResponse

router = APIRouter()


@router.get("", response_model=Page[SystemLogResponse])
async def list_logs(
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    database: Annotated[SupabaseDatabaseClient, Depends(get_database)],
    robot_id: UUID | None = None,
    mission_id: UUID | None = None,
    level: LogLevel | None = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> Page[SystemLogResponse]:
    rows, total = await SystemLogRepository(database).list(
        robot_id=robot_id,
        mission_id=mission_id,
        level=level,
        limit=limit,
        offset=offset,
    )
    return Page(
        items=[SystemLogResponse.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )
