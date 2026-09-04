import asyncio
from uuid import UUID

from fastapi import APIRouter, WebSocket
from pydantic import BaseModel, ValidationError
from starlette.websockets import WebSocketDisconnect

from app.core.errors import AuthenticationError
from app.core.security import CurrentUser
from app.db.client import SupabaseAuthClient
from app.repositories.auth import UserRoleRepository
from app.websocket.manager import ConnectionManager

router = APIRouter()


class AuthenticationMessage(BaseModel):
    type: str
    access_token: str


class SubscriptionMessage(BaseModel):
    type: str
    robot_ids: list[UUID] = []


async def authenticate_websocket(
    token: str, auth_client: SupabaseAuthClient, roles: UserRoleRepository
) -> CurrentUser:
    from app.core.constants import UserRole

    user_id, email = await auth_client.get_user(token)
    role_row = await roles.get(user_id)
    role = UserRole(str(role_row["role"])) if role_row else UserRole.VIEWER
    return CurrentUser(user_id=user_id, email=email, role=role)


@router.websocket("/ws/v1/telemetry")
async def telemetry_socket(websocket: WebSocket) -> None:
    await websocket.accept()
    manager: ConnectionManager = websocket.app.state.websocket_manager
    auth_client: SupabaseAuthClient = websocket.app.state.auth_client
    roles = UserRoleRepository(websocket.app.state.db_client)
    try:
        raw_auth = await asyncio.wait_for(
            websocket.receive_json(),
            timeout=websocket.app.state.settings.websocket_auth_timeout_seconds,
        )
        auth_message = AuthenticationMessage.model_validate(raw_auth)
        if auth_message.type != "authenticate" or not auth_message.access_token:
            raise AuthenticationError()
        await authenticate_websocket(auth_message.access_token, auth_client, roles)
    except (TimeoutError, ValidationError, AuthenticationError):
        await websocket.close(code=4401, reason="authentication failed")
        return

    client = await manager.connect(websocket)
    await websocket.send_json({"type": "authenticated", "schema_version": 1})
    try:
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_json(), timeout=30)
            except TimeoutError:
                await websocket.send_json({"type": "ping", "schema_version": 1})
                continue
            try:
                message = SubscriptionMessage.model_validate(raw)
                if message.type == "subscribe":
                    manager.subscribe(client, set(message.robot_ids))
                    await websocket.send_json(
                        {
                            "type": "subscribed",
                            "schema_version": 1,
                            "robot_ids": [str(item) for item in message.robot_ids],
                        }
                    )
                elif message.type == "ping":
                    await websocket.send_json({"type": "pong", "schema_version": 1})
                else:
                    await websocket.send_json({"type": "error", "code": "MESSAGE_INVALID"})
            except ValidationError:
                await websocket.send_json({"type": "error", "code": "MESSAGE_INVALID"})
    except WebSocketDisconnect:
        pass
    finally:
        await manager.disconnect(client)
