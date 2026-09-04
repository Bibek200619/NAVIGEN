import logging
from datetime import UTC, datetime
from uuid import UUID

from app.core.constants import LogLevel
from app.core.errors import DatabaseError
from app.core.types import JsonValue
from app.repositories.system_logs import SystemLogRepository

logger = logging.getLogger(__name__)


class AuditService:
    def __init__(self, repository: SystemLogRepository) -> None:
        self.repository = repository

    async def write(
        self,
        *,
        level: LogLevel,
        source: str,
        message: str,
        event_code: str | None = None,
        robot_id: UUID | None = None,
        mission_id: UUID | None = None,
        context: dict[str, JsonValue] | None = None,
    ) -> None:
        try:
            await self.repository.create(
                {
                    "robot_id": str(robot_id) if robot_id else None,
                    "mission_id": str(mission_id) if mission_id else None,
                    "level": level.value,
                    "source": source,
                    "event_code": event_code,
                    "message": message,
                    "context": context or {},
                    "recorded_at": datetime.now(UTC).isoformat(),
                }
            )
        except DatabaseError:
            logger.exception(
                "Failed to persist system log",
                extra={"source": source, "event_code": event_code},
            )
