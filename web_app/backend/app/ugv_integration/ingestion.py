import asyncio
import contextlib
import logging
from collections.abc import Mapping
from uuid import UUID

from app.core.constants import ConnectionStatus, LocalizationState, LogLevel, SafetyState
from app.core.errors import DatabaseError, UGVBridgeError
from app.services.audit_service import AuditService
from app.services.telemetry_service import TelemetryService
from app.ugv_integration.bridge import RosbridgeUGVBridge
from app.ugv_integration.mappers import (
    map_localization_state,
    map_localization_status,
    map_motor_telemetry,
    map_odometry,
    map_safety_event,
    map_safety_state,
)
from app.ugv_integration.topics import (
    MOTOR_TELEMETRY_TOPIC,
    ODOMETRY_TOPIC,
    SAFETY_STATE_TOPIC,
)

logger = logging.getLogger(__name__)


class UGVIngestionCoordinator:
    def __init__(
        self,
        robot_id: UUID,
        bridge: RosbridgeUGVBridge,
        telemetry: TelemetryService,
        audit: AuditService,
        *,
        localization_topic: str | None = None,
    ) -> None:
        self.robot_id = robot_id
        self.bridge = bridge
        self.telemetry = telemetry
        self.audit = audit
        self._stop = asyncio.Event()
        self._safety_state: SafetyState | None = None
        self._localization_state: LocalizationState | None = None
        bridge.add_message_handler(MOTOR_TELEMETRY_TOPIC, self._motor)
        bridge.add_message_handler(SAFETY_STATE_TOPIC, self._safety)
        bridge.add_message_handler(ODOMETRY_TOPIC, self._odometry)
        if localization_topic:
            bridge.add_message_handler(localization_topic, self._localization)

    async def run(self) -> None:
        delay = 1.0
        previously_connected = False
        while not self._stop.is_set():
            try:
                await self.bridge.connect()
                if not previously_connected:
                    await self.telemetry.set_connection_status(
                        self.robot_id, ConnectionStatus.CONNECTED
                    )
                    await self.audit.write(
                        level=LogLevel.INFO,
                        source="ugv_bridge",
                        event_code="UGV_BRIDGE_RESTORED",
                        message="UGV bridge connection established.",
                        robot_id=self.robot_id,
                    )
                previously_connected = True
                delay = 1.0
                await self._wait_for_disconnect_or_stop()
                if not self._stop.is_set():
                    await self._log_disconnect()
                    previously_connected = False
            except UGVBridgeError:
                if previously_connected:
                    await self._log_disconnect()
                previously_connected = False
            except DatabaseError:
                logger.exception(
                    "UGV ingestion database operation failed",
                    extra={"source": "ugv_bridge", "event_code": "DATABASE_ERROR"},
                )
            with contextlib.suppress(TimeoutError):
                await asyncio.wait_for(self._stop.wait(), timeout=delay)
            delay = min(delay * 2, 30.0)

    async def stop(self) -> None:
        self._stop.set()
        await self.bridge.disconnect()

    async def _motor(self, message: Mapping[str, object]) -> None:
        await self.telemetry.ingest_motor_telemetry(
            map_motor_telemetry(self.robot_id, message)
        )

    async def _safety(self, message: Mapping[str, object]) -> None:
        numeric_state = message.get("state")
        if not isinstance(numeric_state, int):
            raise ValueError("safety state must be an integer")
        state = map_safety_state(numeric_state)
        if state == self._safety_state:
            return
        self._safety_state = state
        await self.telemetry.ingest_safety_event(map_safety_event(self.robot_id, message))

    async def _localization(self, message: Mapping[str, object]) -> None:
        numeric_state = message.get("state")
        if not isinstance(numeric_state, int):
            raise ValueError("localization state must be an integer")
        state = map_localization_state(numeric_state)
        transition = state != self._localization_state
        self._localization_state = state
        await self.telemetry.ingest_localization(
            map_localization_status(self.robot_id, message), transition=transition
        )

    async def _odometry(self, message: Mapping[str, object]) -> None:
        await self.telemetry.ingest_robot_telemetry(
            map_odometry(
                self.robot_id,
                message,
                safety_state=self._safety_state,
                localization_state=self._localization_state,
            )
        )

    async def _log_disconnect(self) -> None:
        await self.telemetry.set_connection_status(
            self.robot_id, ConnectionStatus.DISCONNECTED
        )
        await self.audit.write(
            level=LogLevel.ERROR,
            source="ugv_bridge",
            event_code="UGV_BRIDGE_DISCONNECTED",
            message="UGV bridge connection was lost; reconnecting with backoff.",
            robot_id=self.robot_id,
        )

    async def _wait_for_disconnect_or_stop(self) -> None:
        disconnected = asyncio.create_task(self.bridge.wait_until_disconnected())
        stopped = asyncio.create_task(self._stop.wait())
        _, pending = await asyncio.wait(
            {disconnected, stopped}, return_when=asyncio.FIRST_COMPLETED
        )
        for task in pending:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
