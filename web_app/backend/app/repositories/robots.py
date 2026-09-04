from datetime import datetime
from uuid import UUID

from app.core.constants import ConnectionStatus
from app.db.client import Row
from app.repositories.base import BaseRepository


class RobotRepository(BaseRepository):
    table = "robots"

    async def list(self, *, limit: int, offset: int) -> tuple[list[Row], int]:
        rows, total = await self.client.select(
            self.table, order="created_at.desc", limit=limit, offset=offset
        )
        return rows, total if total is not None else len(rows)

    async def get(self, robot_id: UUID) -> Row | None:
        return await self._one({"id": f"eq.{robot_id}"})

    async def update_connection(
        self,
        robot_id: UUID,
        connection_status: ConnectionStatus,
        *,
        last_seen_at: datetime | None = None,
    ) -> Row:
        values: Row = {"connection_status": connection_status.value}
        if last_seen_at is not None:
            values["last_seen_at"] = last_seen_at.isoformat()
        return await self._update_one(values, {"id": f"eq.{robot_id}"})
