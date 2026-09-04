from uuid import UUID

from app.core.constants import MissionStatus
from app.db.client import Row
from app.repositories.base import BaseRepository


class MissionRepository(BaseRepository):
    table = "missions"

    async def list_missions(
        self,
        *,
        robot_id: UUID | None,
        status: MissionStatus | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Row], int]:
        filters: dict[str, str] = {}
        if robot_id is not None:
            filters["robot_id"] = f"eq.{robot_id}"
        if status is not None:
            filters["status"] = f"eq.{status.value}"
        rows, total = await self.client.select(
            self.table,
            filters=filters,
            order="created_at.desc",
            limit=limit,
            offset=offset,
        )
        return rows, total if total is not None else len(rows)

    async def get(self, mission_id: UUID) -> Row | None:
        return await self._one({"id": f"eq.{mission_id}"})

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)

    async def update(self, mission_id: UUID, values: Row) -> Row:
        return await self._update_one(values, {"id": f"eq.{mission_id}"})

    async def delete(self, mission_id: UUID) -> None:
        await self.client.delete(self.table, {"id": f"eq.{mission_id}"})


class MissionGoalRepository(BaseRepository):
    table = "mission_goals"

    async def list_for_mission(self, mission_id: UUID) -> list[Row]:
        rows, _ = await self.client.select(
            self.table,
            filters={"mission_id": f"eq.{mission_id}"},
            order="sequence_no.asc",
            limit=500,
        )
        return rows

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)

    async def create_many(self, values: list[Row]) -> list[Row]:
        return await self._insert_many(values)
