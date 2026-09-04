from collections.abc import Mapping, Sequence

from app.core.errors import DatabaseError
from app.core.types import JsonValue
from app.db.client import Row, SupabaseDatabaseClient


class BaseRepository:
    table: str

    def __init__(self, client: SupabaseDatabaseClient) -> None:
        self.client = client

    async def _one(self, filters: Mapping[str, str]) -> Row | None:
        rows, _ = await self.client.select(self.table, filters=filters, limit=1)
        return rows[0] if rows else None

    async def _insert_one(self, values: Row) -> Row:
        rows = await self.client.insert(self.table, values)
        if not rows:
            raise DatabaseError()
        return rows[0]

    async def _insert_many(self, values: Sequence[Row]) -> list[Row]:
        if not values:
            return []
        return await self.client.insert(self.table, values)

    async def _update_one(self, values: dict[str, JsonValue], filters: Mapping[str, str]) -> Row:
        rows = await self.client.update(self.table, values, filters)
        if not rows:
            raise DatabaseError()
        return rows[0]
