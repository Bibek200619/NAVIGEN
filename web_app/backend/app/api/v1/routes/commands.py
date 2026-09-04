from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, status

from app.api.dependencies import get_command_service, require_authenticated, require_operator
from app.core.security import CurrentUser
from app.schemas.command import CommandCreate, CommandResponse
from app.services.command_service import CommandService

router = APIRouter()


@router.post(
    "/robots/{robot_id}/commands",
    response_model=CommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def create_command(
    robot_id: UUID,
    request: CommandCreate,
    user: Annotated[CurrentUser, Depends(require_operator)],
    service: Annotated[CommandService, Depends(get_command_service)],
    idempotency_key: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=8, max_length=128)
    ] = None,
) -> CommandResponse:
    return await service.create(
        robot_id, request, user=user, idempotency_key=idempotency_key
    )


@router.get("/commands/{command_id}", response_model=CommandResponse)
async def get_command(
    command_id: UUID,
    _: Annotated[CurrentUser, Depends(require_authenticated)],
    service: Annotated[CommandService, Depends(get_command_service)],
) -> CommandResponse:
    return await service.get(command_id)
