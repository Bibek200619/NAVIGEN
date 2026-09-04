from uuid import UUID

from app.db.client import Row
from app.repositories.base import BaseRepository


class ProfileRepository(BaseRepository):
    table = "profiles"

    async def get(self, user_id: UUID) -> Row | None:
        return await self._one({"id": f"eq.{user_id}"})


class UserRoleRepository(BaseRepository):
    table = "user_roles"

    async def get(self, user_id: UUID) -> Row | None:
        return await self._one({"user_id": f"eq.{user_id}"})

    async def upsert(self, values: Row) -> Row:
        rows = await self.client.upsert(self.table, values, on_conflict="user_id")
        if not rows:
            from app.core.errors import DatabaseError

            raise DatabaseError()
        return rows[0]
