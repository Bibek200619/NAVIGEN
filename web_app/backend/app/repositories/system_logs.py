from uuid import UUID

from app.core.constants import LogLevel
from app.db.client import Row
from app.repositories.base import BaseRepository


class SystemLogRepository(BaseRepository):
    table = "system_logs"

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)

    async def list(
        self,
        *,
        robot_id: UUID | None,
        mission_id: UUID | None,
        level: LogLevel | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Row], int]:
        filters: dict[str, str] = {}
        if robot_id:
            filters["robot_id"] = f"eq.{robot_id}"
        if mission_id:
            filters["mission_id"] = f"eq.{mission_id}"
        if level:
            filters["level"] = f"eq.{level.value}"
        rows, total = await self.client.select(
            self.table,
            filters=filters,
            order="recorded_at.desc",
            limit=limit,
            offset=offset,
        )
        return rows, total if total is not None else len(rows)
