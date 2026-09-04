from datetime import UTC, datetime
from uuid import UUID

from app.core.constants import MISSION_TRANSITIONS, MissionStatus, WebSocketEventType
from app.core.errors import ConflictError, DatabaseError, NotFoundError
from app.core.types import JsonValue
from app.repositories.missions import MissionGoalRepository, MissionRepository
from app.repositories.robots import RobotRepository
from app.schemas.common import Page
from app.schemas.mission import (
    MissionCreate,
    MissionDetailResponse,
    MissionGoalCreate,
    MissionGoalResponse,
    MissionResponse,
    MissionUpdate,
)
from app.websocket.events import WebSocketEvent
from app.websocket.manager import ConnectionManager


def validate_mission_transition(current: MissionStatus, target: MissionStatus) -> None:
    if current == target:
        return
    if target not in MISSION_TRANSITIONS[current]:
        raise ConflictError(
            "MISSION_INVALID_STATE",
            f"Mission cannot transition from {current.value} to {target.value}.",
        )


class MissionService:
    def __init__(
        self,
        missions: MissionRepository,
        goals: MissionGoalRepository,
        robots: RobotRepository,
        websocket_manager: ConnectionManager,
    ) -> None:
        self.missions = missions
        self.goals = goals
        self.robots = robots
        self.websocket_manager = websocket_manager

    async def list_missions(
        self,
        *,
        robot_id: UUID | None,
        status: MissionStatus | None,
        limit: int,
        offset: int,
    ) -> Page[MissionResponse]:
        rows, total = await self.missions.list_missions(
            robot_id=robot_id, status=status, limit=limit, offset=offset
        )
        return Page(
            items=[MissionResponse.model_validate(row) for row in rows],
            total=total,
            limit=limit,
            offset=offset,
        )

    async def get(self, mission_id: UUID) -> MissionDetailResponse:
        mission = await self._get_row(mission_id)
        goals = await self.goals.list_for_mission(mission_id)
        return MissionDetailResponse(
            **mission,
            goals=[MissionGoalResponse.model_validate(row) for row in goals],
        )

    async def create(self, request: MissionCreate, *, created_by: UUID) -> MissionDetailResponse:
        if await self.robots.get(request.robot_id) is None:
            raise NotFoundError("ROBOT_NOT_FOUND", "Robot not found.")
        mission_values: dict[str, JsonValue] = {
            "robot_id": str(request.robot_id),
            "name": request.name,
            "description": request.description,
            "status": MissionStatus.PENDING.value,
            "created_by": str(created_by),
        }
        mission = await self.missions.create(mission_values)
        mission_id = UUID(str(mission["id"]))
        try:
            goal_values = [
                self._goal_values(mission_id, goal, index)
                for index, goal in enumerate(request.goals)
            ]
            created_goals = await self.goals.create_many(goal_values)
        except Exception:
            # Compensating delete prevents a predictable half-created mission because
            # PostgREST does not provide a cross-request transaction boundary.
            await self.missions.delete(mission_id)
            raise
        response = MissionDetailResponse(
            **mission,
            goals=[MissionGoalResponse.model_validate(row) for row in created_goals],
        )
        await self._broadcast(WebSocketEventType.MISSION_CREATED, response)
        return response

    async def update(self, mission_id: UUID, request: MissionUpdate) -> MissionResponse:
        current = await self._get_row(mission_id)
        values = request.model_dump(exclude_unset=True, mode="json")
        if request.status is not None:
            current_status = MissionStatus(str(current["status"]))
            validate_mission_transition(current_status, request.status)
            now = datetime.now(UTC).isoformat()
            if request.status is not current_status and request.status is MissionStatus.IN_PROGRESS:
                values["started_at"] = now
            if request.status is not current_status and request.status in {
                MissionStatus.COMPLETED,
                MissionStatus.FAILED,
                MissionStatus.ABORTED,
            }:
                values["completed_at"] = now
        resulting_status = request.status or MissionStatus(str(current["status"]))
        if request.failure_reason is not None and resulting_status not in {
            MissionStatus.FAILED,
            MissionStatus.ABORTED,
        }:
            raise ConflictError(
                "MISSION_INVALID_STATE",
                "failure_reason is only valid for failed or aborted missions.",
            )
        updated = MissionResponse.model_validate(await self.missions.update(mission_id, values))
        await self._broadcast(WebSocketEventType.MISSION_UPDATED, updated)
        return updated

    async def list_goals(self, mission_id: UUID) -> list[MissionGoalResponse]:
        await self._get_row(mission_id)
        return [
            MissionGoalResponse.model_validate(row)
            for row in await self.goals.list_for_mission(mission_id)
        ]

    async def create_goal(
        self, mission_id: UUID, request: MissionGoalCreate
    ) -> MissionGoalResponse:
        mission = await self._get_row(mission_id)
        status = MissionStatus(str(mission["status"]))
        if status not in {MissionStatus.PENDING, MissionStatus.IN_PROGRESS}:
            raise ConflictError(
                "MISSION_INVALID_STATE", "Goals cannot be added to a terminal mission."
            )
        existing = await self.goals.list_for_mission(mission_id)
        sequences = [self._sequence_number(row) for row in existing]
        next_sequence = max(sequences, default=-1) + 1
        sequence = request.sequence_no if request.sequence_no is not None else next_sequence
        if sequence in sequences:
            raise ConflictError("MISSION_GOAL_CONFLICT", "Goal sequence_no already exists.")
        row = await self.goals.create(self._goal_values(mission_id, request, sequence))
        response = MissionGoalResponse.model_validate(row)
        await self._broadcast(
            WebSocketEventType.MISSION_UPDATED, MissionResponse.model_validate(mission)
        )
        return response

    async def _get_row(self, mission_id: UUID) -> dict[str, JsonValue]:
        row = await self.missions.get(mission_id)
        if row is None:
            raise NotFoundError("MISSION_NOT_FOUND", "Mission not found.")
        return row

    @staticmethod
    def _sequence_number(row: dict[str, JsonValue]) -> int:
        value = row.get("sequence_no")
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise DatabaseError("Mission goal contains an invalid sequence_no.")
        try:
            return int(value)
        except ValueError as exc:
            raise DatabaseError("Mission goal contains an invalid sequence_no.") from exc

    @staticmethod
    def _goal_values(
        mission_id: UUID, request: MissionGoalCreate, default_sequence: int
    ) -> dict[str, JsonValue]:
        values = request.model_dump(exclude={"sequence_no"}, mode="json")
        values["mission_id"] = str(mission_id)
        values["sequence_no"] = (
            request.sequence_no if request.sequence_no is not None else default_sequence
        )
        return values

    async def _broadcast(
        self, event_type: WebSocketEventType, mission: MissionResponse
    ) -> None:
        now = datetime.now(UTC)
        await self.websocket_manager.broadcast(
            WebSocketEvent(
                event_type=event_type,
                robot_id=mission.robot_id,
                recorded_at=now,
                received_at=now,
                payload=mission.model_dump(mode="json"),
            )
        )
