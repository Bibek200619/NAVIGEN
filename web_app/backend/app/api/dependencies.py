from typing import Annotated, cast

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.constants import UserRole
from app.core.errors import AuthenticationError, AuthorizationError
from app.core.security import CurrentUser
from app.db.client import SupabaseAuthClient, SupabaseDatabaseClient
from app.repositories.auth import UserRoleRepository
from app.repositories.commands import CommandRepository
from app.repositories.missions import MissionGoalRepository, MissionRepository
from app.repositories.robots import RobotRepository
from app.repositories.system_logs import SystemLogRepository
from app.services.audit_service import AuditService
from app.services.command_service import CommandService
from app.services.mission_service import MissionService
from app.services.robot_service import RobotService
from app.services.telemetry_service import TelemetryService

bearer = HTTPBearer(auto_error=False)


def get_database(request: Request) -> SupabaseDatabaseClient:
    return cast(SupabaseDatabaseClient, request.app.state.db_client)


def get_auth_client(request: Request) -> SupabaseAuthClient:
    return cast(SupabaseAuthClient, request.app.state.auth_client)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
    auth_client: Annotated[SupabaseAuthClient, Depends(get_auth_client)],
    database: Annotated[SupabaseDatabaseClient, Depends(get_database)],
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise AuthenticationError()
    user_id, email = await auth_client.get_user(credentials.credentials)
    row = await UserRoleRepository(database).get(user_id)
    role = UserRole(str(row["role"])) if row is not None else UserRole.VIEWER
    return CurrentUser(user_id=user_id, email=email, role=role)


async def require_authenticated(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    return user


async def require_operator(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if user.role not in {UserRole.OPERATOR, UserRole.ADMIN}:
        raise AuthorizationError()
    return user


async def require_admin(
    user: Annotated[CurrentUser, Depends(get_current_user)],
) -> CurrentUser:
    if user.role is not UserRole.ADMIN:
        raise AuthorizationError()
    return user


def get_robot_service(
    database: Annotated[SupabaseDatabaseClient, Depends(get_database)],
) -> RobotService:
    return RobotService(RobotRepository(database))


def get_telemetry_service(request: Request) -> TelemetryService:
    return cast(TelemetryService, request.app.state.telemetry_service)


def get_mission_service(
    request: Request, database: Annotated[SupabaseDatabaseClient, Depends(get_database)]
) -> MissionService:
    return MissionService(
        MissionRepository(database),
        MissionGoalRepository(database),
        RobotRepository(database),
        request.app.state.websocket_manager,
    )


def get_command_service(
    request: Request,
    database: Annotated[SupabaseDatabaseClient, Depends(get_database)],
    telemetry: Annotated[TelemetryService, Depends(get_telemetry_service)],
) -> CommandService:
    return CommandService(
        CommandRepository(database),
        RobotRepository(database),
        MissionRepository(database),
        telemetry,
        request.app.state.ugv_bridge,
        request.app.state.websocket_manager,
        AuditService(SystemLogRepository(database)),
    )
