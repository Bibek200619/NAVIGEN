from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.dependencies import get_database, require_admin
from app.core.security import CurrentUser
from app.db.client import SupabaseDatabaseClient
from app.repositories.auth import UserRoleRepository
from app.schemas.system import UserRoleResponse, UserRoleUpdate

router = APIRouter()


@router.put("/users/{user_id}/role", response_model=UserRoleResponse)
async def set_user_role(
    user_id: UUID,
    request: UserRoleUpdate,
    _: Annotated[CurrentUser, Depends(require_admin)],
    database: Annotated[SupabaseDatabaseClient, Depends(get_database)],
) -> UserRoleResponse:
    row = await UserRoleRepository(database).upsert(
        {
            "user_id": str(user_id),
            "role": request.role.value,
            "updated_at": datetime.now(UTC).isoformat(),
        }
    )
    return UserRoleResponse.model_validate(row)
