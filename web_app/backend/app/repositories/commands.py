from uuid import UUID

from app.db.client import Row
from app.repositories.base import BaseRepository


class CommandRepository(BaseRepository):
    table = "commands"

    async def get(self, command_id: UUID) -> Row | None:
        return await self._one({"id": f"eq.{command_id}"})

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)

    async def update(self, command_id: UUID, values: Row) -> Row:
        return await self._update_one(values, {"id": f"eq.{command_id}"})
