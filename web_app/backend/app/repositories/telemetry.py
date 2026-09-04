from datetime import datetime
from uuid import UUID

from app.db.client import Row
from app.repositories.base import BaseRepository


def _time_filters(
    robot_id: UUID, from_time: datetime | None, to_time: datetime | None
) -> dict[str, str]:
    filters = {"robot_id": f"eq.{robot_id}"}
    if from_time is not None:
        filters["recorded_at"] = f"gte.{from_time.isoformat()}"
    if to_time is not None:
        # PostgREST cannot represent two operators for one key in a dict. The API client
        # accepts an `and` expression for the bounded case.
        if from_time is not None:
            filters.pop("recorded_at")
            filters["and"] = (
                f"(recorded_at.gte.{from_time.isoformat()},recorded_at.lte.{to_time.isoformat()})"
            )
        else:
            filters["recorded_at"] = f"lte.{to_time.isoformat()}"
    return filters


class RobotTelemetryRepository(BaseRepository):
    table = "robot_telemetry"

    async def history(
        self,
        robot_id: UUID,
        *,
        from_time: datetime | None,
        to_time: datetime | None,
        limit: int,
    ) -> list[Row]:
        rows, _ = await self.client.select(
            self.table,
            filters=_time_filters(robot_id, from_time, to_time),
            order="recorded_at.desc",
            limit=limit,
        )
        return rows

    async def latest(self, robot_id: UUID) -> Row | None:
        rows, _ = await self.client.select(
            self.table,
            filters={"robot_id": f"eq.{robot_id}"},
            order="recorded_at.desc",
            limit=1,
        )
        return rows[0] if rows else None

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)


class MotorTelemetryRepository(BaseRepository):
    table = "motor_telemetry"

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)


class SafetyEventRepository(BaseRepository):
    table = "safety_events"

    async def history(self, robot_id: UUID, *, limit: int) -> list[Row]:
        rows, _ = await self.client.select(
            self.table,
            filters={"robot_id": f"eq.{robot_id}"},
            order="recorded_at.desc",
            limit=limit,
        )
        return rows

    async def latest(self, robot_id: UUID) -> Row | None:
        rows = await self.history(robot_id, limit=1)
        return rows[0] if rows else None

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)


class LocalizationStatusRepository(BaseRepository):
    table = "localization_status"

    async def latest(self, robot_id: UUID) -> Row | None:
        rows, _ = await self.client.select(
            self.table,
            filters={"robot_id": f"eq.{robot_id}"},
            order="recorded_at.desc",
            limit=1,
        )
        return rows[0] if rows else None

    async def create(self, values: Row) -> Row:
        return await self._insert_one(values)


class SensorStatusRepository(BaseRepository):
    table = "sensor_status"

    async def list(self, robot_id: UUID) -> list[Row]:
        rows, _ = await self.client.select(
            self.table,
            filters={"robot_id": f"eq.{robot_id}"},
            order="sensor_key.asc",
            limit=250,
        )
        return rows

    async def upsert(self, values: Row) -> Row:
        rows = await self.client.upsert(
            self.table, values, on_conflict="robot_id,sensor_key"
        )
        if not rows:
            from app.core.errors import DatabaseError

            raise DatabaseError()
        return rows[0]
