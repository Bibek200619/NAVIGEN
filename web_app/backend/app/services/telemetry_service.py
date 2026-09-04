import asyncio
from datetime import UTC, datetime
from time import monotonic
from uuid import UUID

from app.core.constants import ConnectionStatus, WebSocketEventType
from app.core.errors import AppError
from app.core.types import JsonValue
from app.repositories.robots import RobotRepository
from app.repositories.telemetry import (
    LocalizationStatusRepository,
    MotorTelemetryRepository,
    RobotTelemetryRepository,
    SafetyEventRepository,
    SensorStatusRepository,
)
from app.schemas.common import APIModel
from app.schemas.telemetry import (
    LocalizationStatusResponse,
    MotorTelemetry,
    RobotTelemetryResponse,
    SafetyEventResponse,
    SensorStatusResponse,
    SensorStatusUpsert,
)
from app.websocket.events import WebSocketEvent
from app.websocket.manager import ConnectionManager


def calculate_freshness(
    recorded_at: datetime, *, now: datetime | None = None, stale_threshold_ms: int
) -> tuple[int, bool]:
    current = now or datetime.now(UTC)
    if recorded_at.tzinfo is None or recorded_at.utcoffset() is None:
        raise ValueError("recorded_at must include a timezone")
    age_ms = max(0, int((current - recorded_at).total_seconds() * 1000))
    return age_ms, age_ms > stale_threshold_ms


class TelemetryService:
    def __init__(
        self,
        robot_telemetry: RobotTelemetryRepository,
        motor_telemetry: MotorTelemetryRepository,
        safety_events: SafetyEventRepository,
        localization: LocalizationStatusRepository,
        sensors: SensorStatusRepository,
        robots: RobotRepository,
        websocket_manager: ConnectionManager,
        *,
        stale_threshold_ms: int,
        persistence_enabled: bool,
        persistence_rate_hz: float,
    ) -> None:
        self.robot_telemetry = robot_telemetry
        self.motor_telemetry = motor_telemetry
        self.safety_events = safety_events
        self.localization = localization
        self.sensors = sensors
        self.robots = robots
        self.websocket_manager = websocket_manager
        self.stale_threshold_ms = stale_threshold_ms
        self.persistence_enabled = persistence_enabled
        self.persistence_interval = 1 / persistence_rate_hz
        self._last_persisted: dict[tuple[str, UUID], float] = {}
        self._latest_robot: dict[UUID, RobotTelemetryResponse] = {}
        self._persistence_lock = asyncio.Lock()

    async def history(
        self,
        robot_id: UUID,
        *,
        from_time: datetime | None,
        to_time: datetime | None,
        limit: int,
    ) -> list[RobotTelemetryResponse]:
        if from_time is not None and to_time is not None and from_time > to_time:
            raise AppError(
                "VALIDATION_ERROR",
                "The 'from' timestamp must not be later than 'to'.",
                status_code=422,
            )
        rows = await self.robot_telemetry.history(
            robot_id, from_time=from_time, to_time=to_time, limit=limit
        )
        return [self._with_current_freshness(row) for row in rows]

    async def set_connection_status(
        self, robot_id: UUID, status: ConnectionStatus
    ) -> None:
        now = datetime.now(UTC)
        await self.robots.update_connection(
            robot_id,
            status,
            last_seen_at=now if status is ConnectionStatus.CONNECTED else None,
        )
        await self.websocket_manager.broadcast(
            WebSocketEvent(
                event_type=WebSocketEventType.ROBOT_CONNECTION,
                robot_id=robot_id,
                recorded_at=now,
                received_at=now,
                payload={"connection_status": status.value},
            )
        )

    async def latest(self, robot_id: UUID) -> RobotTelemetryResponse | None:
        live = self._latest_robot.get(robot_id)
        if live is not None:
            age_ms, stale = calculate_freshness(
                live.recorded_at, stale_threshold_ms=self.stale_threshold_ms
            )
            return live.model_copy(update={"data_age_ms": age_ms, "is_stale": stale})
        row = await self.robot_telemetry.latest(robot_id)
        return self._with_current_freshness(row) if row else None

    async def safety_history(self, robot_id: UUID, *, limit: int) -> list[SafetyEventResponse]:
        return [
            SafetyEventResponse.model_validate(row)
            for row in await self.safety_events.history(robot_id, limit=limit)
        ]

    async def latest_safety(self, robot_id: UUID) -> SafetyEventResponse | None:
        row = await self.safety_events.latest(robot_id)
        return SafetyEventResponse.model_validate(row) if row else None

    async def latest_localization(self, robot_id: UUID) -> LocalizationStatusResponse | None:
        row = await self.localization.latest(robot_id)
        return LocalizationStatusResponse.model_validate(row) if row else None

    async def sensor_statuses(self, robot_id: UUID) -> list[SensorStatusResponse]:
        return [
            SensorStatusResponse.model_validate(row)
            for row in await self.sensors.list(robot_id)
        ]

    async def ingest_robot_telemetry(self, telemetry: RobotTelemetryResponse) -> None:
        age_ms, stale = calculate_freshness(
            telemetry.recorded_at,
            now=telemetry.received_at,
            stale_threshold_ms=self.stale_threshold_ms,
        )
        telemetry = telemetry.model_copy(update={"data_age_ms": age_ms, "is_stale": stale})
        self._latest_robot[telemetry.robot_id] = telemetry
        await self._broadcast(WebSocketEventType.ROBOT_TELEMETRY, telemetry)
        await self.robots.update_connection(
            telemetry.robot_id, telemetry.connection_status, last_seen_at=telemetry.received_at
        )
        if await self._should_persist("robot", telemetry.robot_id):
            await self.robot_telemetry.create(
                telemetry.model_dump(exclude={"id", "created_at"}, mode="json")
            )

    async def ingest_motor_telemetry(self, telemetry: MotorTelemetry) -> None:
        await self._broadcast(WebSocketEventType.MOTOR_TELEMETRY, telemetry)
        if await self._should_persist("motor", telemetry.robot_id):
            await self.motor_telemetry.create(telemetry.model_dump(mode="json"))

    async def ingest_safety_event(self, values: dict[str, JsonValue]) -> SafetyEventResponse:
        live_event = SafetyEventResponse.model_validate(values)
        await self._broadcast(WebSocketEventType.SAFETY_CHANGED, live_event)
        row = await self.safety_events.create(values)
        event = SafetyEventResponse.model_validate(row)
        return event

    async def ingest_localization(
        self, values: dict[str, JsonValue], *, transition: bool = False
    ) -> LocalizationStatusResponse:
        robot_id = UUID(str(values["robot_id"]))
        live_status = LocalizationStatusResponse.model_validate(values)
        await self._broadcast(WebSocketEventType.LOCALIZATION_CHANGED, live_status)
        if transition or await self._should_persist("localization", robot_id):
            row = await self.localization.create(values)
            status = LocalizationStatusResponse.model_validate(row)
        else:
            status = live_status
        return status

    async def upsert_sensor(self, status: SensorStatusUpsert) -> SensorStatusResponse:
        row = await self.sensors.upsert(status.model_dump(mode="json"))
        response = SensorStatusResponse.model_validate(row)
        await self._broadcast(WebSocketEventType.SENSOR_STATUS, response)
        return response

    def _with_current_freshness(self, row: dict[str, JsonValue]) -> RobotTelemetryResponse:
        telemetry = RobotTelemetryResponse.model_validate(row)
        age_ms, stale = calculate_freshness(
            telemetry.recorded_at, stale_threshold_ms=self.stale_threshold_ms
        )
        return telemetry.model_copy(update={"data_age_ms": age_ms, "is_stale": stale})

    async def _should_persist(self, stream: str, robot_id: UUID) -> bool:
        if not self.persistence_enabled:
            return False
        now = monotonic()
        key = (stream, robot_id)
        async with self._persistence_lock:
            previous = self._last_persisted.get(key)
            if previous is not None and now - previous < self.persistence_interval:
                return False
            self._last_persisted[key] = now
            return True

    async def _broadcast(self, event_type: WebSocketEventType, model: APIModel) -> None:
        payload = model.model_dump(mode="json")
        now = datetime.now(UTC)
        recorded_value = (
            payload.get("recorded_at")
            or payload.get("last_updated_at")
            or payload.get("updated_at")
        )
        received_value = payload.get("received_at") or payload.get("updated_at")
        recorded_at = (
            datetime.fromisoformat(str(recorded_value)) if recorded_value else now
        )
        received_at = (
            datetime.fromisoformat(str(received_value)) if received_value else now
        )
        await self.websocket_manager.broadcast(
            WebSocketEvent(
                event_type=event_type,
                robot_id=UUID(str(payload["robot_id"])),
                recorded_at=recorded_at,
                received_at=received_at,
                payload=payload,
            )
        )
