from datetime import UTC, datetime
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from pydantic import ValidationError

from app.core.constants import (
    CommandStatus,
    CommandType,
    ConnectionStatus,
    LocalizationState,
    LogLevel,
    MissionStatus,
    SafetyState,
    WebSocketEventType,
)
from app.core.errors import ConflictError, NotFoundError, UGVBridgeError
from app.core.security import CurrentUser
from app.core.types import JsonValue
from app.repositories.commands import CommandRepository
from app.repositories.missions import MissionRepository
from app.repositories.robots import RobotRepository
from app.schemas.command import (
    CommandCreate,
    CommandResponse,
    SetGoalPayload,
    SoftwareEstopPayload,
)
from app.schemas.mission import MissionGoalCreate
from app.services.audit_service import AuditService
from app.services.telemetry_service import TelemetryService
from app.ugv_integration.bridge import UGVBridge
from app.websocket.events import WebSocketEvent
from app.websocket.manager import ConnectionManager


class CommandService:
    def __init__(
        self,
        commands: CommandRepository,
        robots: RobotRepository,
        missions: MissionRepository,
        telemetry: TelemetryService,
        bridge: UGVBridge,
        websocket_manager: ConnectionManager,
        audit: AuditService,
    ) -> None:
        self.commands = commands
        self.robots = robots
        self.missions = missions
        self.telemetry = telemetry
        self.bridge = bridge
        self.websocket_manager = websocket_manager
        self.audit = audit

    async def get(self, command_id: UUID) -> CommandResponse:
        row = await self.commands.get(command_id)
        if row is None:
            raise NotFoundError("COMMAND_NOT_FOUND", "Command not found.")
        return CommandResponse.model_validate(row)

    async def create(
        self,
        robot_id: UUID,
        request: CommandCreate,
        *,
        user: CurrentUser,
        idempotency_key: str | None,
    ) -> CommandResponse:
        robot = await self.robots.get(robot_id)
        if robot is None:
            raise NotFoundError("ROBOT_NOT_FOUND", "Robot not found.")

        command_id = self._command_id(user.user_id, robot_id, idempotency_key)
        if idempotency_key:
            existing = await self.commands.get(command_id)
            if existing is not None:
                existing_response = CommandResponse.model_validate(existing)
                if (
                    existing_response.command_type is not request.command_type
                    or existing_response.mission_id != request.mission_id
                    or existing_response.request_payload != request.payload
                ):
                    raise ConflictError(
                        "IDEMPOTENCY_CONFLICT",
                        "Idempotency-Key was already used for a different command.",
                    )
                return existing_response

        now = datetime.now(UTC)
        pending = await self.commands.create(
            {
                "id": str(command_id),
                "robot_id": str(robot_id),
                "mission_id": str(request.mission_id) if request.mission_id else None,
                "requested_by": str(user.user_id),
                "command_type": request.command_type.value,
                "status": CommandStatus.PENDING.value,
                "request_payload": request.payload,
                "response_payload": {},
                "requested_at": now.isoformat(),
            }
        )
        await self._broadcast(CommandResponse.model_validate(pending))

        rejection = await self._validate(robot, request)
        if rejection is not None:
            return await self._reject(command_id, robot_id, request.mission_id, rejection)

        try:
            if request.command_type is CommandType.SET_GOAL:
                goal = self._validate_goal(request.payload)
                response_payload = dict(await self.bridge.send_goal(goal))
            else:
                estop = SoftwareEstopPayload.model_validate(request.payload)
                response_payload = dict(await self.bridge.set_software_estop(estop.active))
        except (UGVBridgeError, OSError, TimeoutError):
            return await self._reject(
                command_id, robot_id, request.mission_id, "UGV_BRIDGE_UNAVAILABLE"
            )

        accepted_at = datetime.now(UTC)
        updated = await self.commands.update(
            command_id,
            {
                "status": CommandStatus.ACCEPTED.value,
                "acknowledged_at": accepted_at.isoformat(),
                "response_payload": response_payload,
            },
        )
        response = CommandResponse.model_validate(updated)
        await self._broadcast(response)
        if request.command_type is CommandType.SOFTWARE_ESTOP:
            await self.audit.write(
                level=LogLevel.WARNING,
                source="command_service",
                event_code="SOFTWARE_ESTOP_REQUESTED",
                message="Software e-stop assertion was accepted.",
                robot_id=robot_id,
                context={"command_id": str(command_id), "requested_by": str(user.user_id)},
            )
        return response

    async def _validate(
        self, robot: dict[str, JsonValue], request: CommandCreate
    ) -> str | None:
        if str(robot.get("connection_status")) != ConnectionStatus.CONNECTED.value:
            return "ROBOT_OFFLINE"

        try:
            if request.command_type is CommandType.SET_GOAL:
                self._validate_goal(request.payload)
            else:
                estop = SoftwareEstopPayload.model_validate(request.payload)
                if not estop.active:
                    return "COMMAND_REJECTED"
        except ValidationError:
            return "COMMAND_INVALID"

        if request.command_type is CommandType.SOFTWARE_ESTOP:
            return None

        telemetry = await self.telemetry.latest(UUID(str(robot["id"])))
        if telemetry is None or telemetry.is_stale:
            return "ROBOT_TELEMETRY_STALE"
        if telemetry.safety_state is not SafetyState.OK:
            return "ROBOT_UNSAFE"
        if telemetry.localization_state is not LocalizationState.TRACKING:
            return "ROBOT_UNSAFE"

        if request.mission_id is not None:
            mission = await self.missions.get(request.mission_id)
            if mission is None or str(mission.get("robot_id")) != str(robot["id"]):
                return "MISSION_NOT_FOUND"
            if MissionStatus(str(mission["status"])) not in {
                MissionStatus.PENDING,
                MissionStatus.IN_PROGRESS,
            }:
                return "MISSION_INVALID_STATE"
        return None

    @staticmethod
    def _validate_goal(payload: dict[str, JsonValue]) -> SetGoalPayload:
        goal = SetGoalPayload.model_validate(payload)
        MissionGoalCreate(
            frame_id=goal.frame_id,
            position_x=goal.position.x,
            position_y=goal.position.y,
            position_z=goal.position.z,
            orientation_x=goal.orientation.x,
            orientation_y=goal.orientation.y,
            orientation_z=goal.orientation.z,
            orientation_w=goal.orientation.w,
        )
        return goal

    async def _reject(
        self,
        command_id: UUID,
        robot_id: UUID,
        mission_id: UUID | None,
        reason: str,
    ) -> CommandResponse:
        row = await self.commands.update(
            command_id,
            {
                "status": CommandStatus.REJECTED.value,
                "rejection_reason": reason,
                "acknowledged_at": datetime.now(UTC).isoformat(),
                "response_payload": {"error_code": reason},
            },
        )
        response = CommandResponse.model_validate(row)
        await self._broadcast(response)
        await self.audit.write(
            level=LogLevel.WARNING,
            source="command_service",
            event_code="COMMAND_REJECTED",
            message="Command was rejected before UGV dispatch.",
            robot_id=robot_id,
            mission_id=mission_id,
            context={"command_id": str(command_id), "reason": reason},
        )
        return response

    async def _broadcast(self, command: CommandResponse) -> None:
        now = datetime.now(UTC)
        await self.websocket_manager.broadcast(
            WebSocketEvent(
                event_type=WebSocketEventType.COMMAND_UPDATED,
                robot_id=command.robot_id,
                recorded_at=now,
                received_at=now,
                payload=command.model_dump(mode="json"),
            )
        )

    @staticmethod
    def _command_id(user_id: UUID, robot_id: UUID, idempotency_key: str | None) -> UUID:
        if not idempotency_key:
            return uuid4()
        return uuid5(NAMESPACE_URL, f"navigen:{user_id}:{robot_id}:{idempotency_key}")
