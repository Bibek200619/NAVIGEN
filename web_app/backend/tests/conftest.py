from __future__ import annotations

from collections.abc import AsyncIterator, Mapping, Sequence
from copy import deepcopy
from datetime import UTC, datetime
from uuid import UUID, uuid4

import httpx
import pytest
import pytest_asyncio

from app.core.config import Settings
from app.core.errors import AuthenticationError
from app.core.types import JsonValue
from app.main import create_app
from app.repositories.robots import RobotRepository
from app.repositories.telemetry import (
    LocalizationStatusRepository,
    MotorTelemetryRepository,
    RobotTelemetryRepository,
    SafetyEventRepository,
    SensorStatusRepository,
)
from app.services.telemetry_service import TelemetryService
from app.websocket.manager import ConnectionManager

Row = dict[str, JsonValue]

ROBOT_ID = UUID("10000000-0000-0000-0000-000000000001")
OPERATOR_ID = UUID("20000000-0000-0000-0000-000000000001")
VIEWER_ID = UUID("20000000-0000-0000-0000-000000000002")
ADMIN_ID = UUID("20000000-0000-0000-0000-000000000003")


class FakeDatabase:
    def __init__(self) -> None:
        now = datetime.now(UTC).isoformat()
        self.tables: dict[str, list[Row]] = {
            "robots": [
                {
                    "id": str(ROBOT_ID),
                    "name": "NAVIGEN One",
                    "slug": "navigen-one",
                    "status": "idle",
                    "connection_status": "connected",
                    "last_seen_at": now,
                    "description": "Test UGV",
                    "metadata": {},
                    "created_at": now,
                    "updated_at": now,
                }
            ],
            "user_roles": [
                self._role(OPERATOR_ID, "operator", now),
                self._role(VIEWER_ID, "viewer", now),
                self._role(ADMIN_ID, "admin", now),
            ],
            "profiles": [],
            "missions": [],
            "mission_goals": [],
            "commands": [],
            "robot_telemetry": [],
            "motor_telemetry": [],
            "safety_events": [],
            "localization_status": [],
            "sensor_status": [],
            "system_logs": [],
        }

    @staticmethod
    def _role(user_id: UUID, role: str, now: str) -> Row:
        return {
            "id": str(uuid4()),
            "user_id": str(user_id),
            "role": role,
            "created_at": now,
            "updated_at": now,
        }

    async def health(self) -> bool:
        return True

    async def close(self) -> None:
        return None

    async def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: Mapping[str, str] | None = None,
        order: str | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> tuple[list[Row], int | None]:
        del columns
        rows = [deepcopy(row) for row in self.tables[table]]
        for key, expression in (filters or {}).items():
            if key == "and":
                continue
            operation, expected = expression.split(".", 1)
            if operation == "eq":
                rows = [row for row in rows if str(row.get(key)) == expected]
            elif operation == "gte":
                rows = [row for row in rows if str(row.get(key)) >= expected]
            elif operation == "lte":
                rows = [row for row in rows if str(row.get(key)) <= expected]
        if order:
            field, direction = order.split(".", 1)
            rows.sort(key=lambda row: str(row.get(field, "")), reverse=direction == "desc")
        total = len(rows)
        rows = rows[offset : offset + limit if limit is not None else None]
        return rows, total

    async def insert(self, table: str, values: Row | Sequence[Row]) -> list[Row]:
        payloads = [values] if isinstance(values, dict) else list(values)
        created: list[Row] = []
        for source in payloads:
            row = deepcopy(source)
            now = datetime.now(UTC).isoformat()
            row.setdefault("id", str(uuid4()))
            row.setdefault("created_at", now)
            timestamped_tables = {
                "robots",
                "missions",
                "commands",
                "profiles",
                "user_roles",
                "sensor_status",
            }
            if table in timestamped_tables:
                row.setdefault("updated_at", now)
            if table == "commands":
                row.setdefault("response_payload", {})
            self.tables[table].append(row)
            created.append(deepcopy(row))
        return created

    async def update(self, table: str, values: Row, filters: Mapping[str, str]) -> list[Row]:
        updated: list[Row] = []
        for row in self.tables[table]:
            if all(
                str(row.get(key)) == expression.split(".", 1)[1]
                for key, expression in filters.items()
            ):
                row.update(deepcopy(values))
                if "updated_at" in row:
                    row["updated_at"] = datetime.now(UTC).isoformat()
                updated.append(deepcopy(row))
        return updated

    async def upsert(self, table: str, values: Row, *, on_conflict: str) -> list[Row]:
        keys = on_conflict.split(",")
        for row in self.tables[table]:
            if all(row.get(key) == values.get(key) for key in keys):
                row.update(deepcopy(values))
                row["updated_at"] = datetime.now(UTC).isoformat()
                return [deepcopy(row)]
        return await self.insert(table, values)

    async def delete(self, table: str, filters: Mapping[str, str]) -> None:
        self.tables[table] = [
            row
            for row in self.tables[table]
            if not all(
                str(row.get(key)) == expression.split(".", 1)[1]
                for key, expression in filters.items()
            )
        ]


class FakeAuth:
    users = {
        "operator-token": (OPERATOR_ID, "operator@example.com"),
        "viewer-token": (VIEWER_ID, "viewer@example.com"),
        "admin-token": (ADMIN_ID, "admin@example.com"),
    }

    async def get_user(self, access_token: str) -> tuple[UUID, str | None]:
        if access_token not in self.users:
            raise AuthenticationError("The access token is invalid or expired.")
        return self.users[access_token]

    async def close(self) -> None:
        return None


class FakeBridge:
    def __init__(self) -> None:
        self.connected = True
        self.goals: list[object] = []
        self.estops: list[bool] = []

    async def connect(self) -> None:
        self.connected = True

    async def disconnect(self) -> None:
        self.connected = False

    async def health(self) -> bool:
        return self.connected

    async def send_goal(self, payload: object) -> Mapping[str, JsonValue]:
        self.goals.append(payload)
        return {"topic": "/goal_pose", "published": True}

    async def set_software_estop(self, active: bool) -> Mapping[str, JsonValue]:
        self.estops.append(active)
        return {"topic": "/safety/e_stop", "published": True, "active": active}


@pytest.fixture
def auth_headers() -> dict[str, dict[str, str]]:
    return {
        "operator": {"Authorization": "Bearer operator-token"},
        "viewer": {"Authorization": "Bearer viewer-token"},
        "admin": {"Authorization": "Bearer admin-token"},
    }


@pytest_asyncio.fixture
async def api_context() -> AsyncIterator[
    tuple[httpx.AsyncClient, object, FakeDatabase, FakeBridge]
]:
    settings = Settings(
        app_env="test",
        supabase_url="",
        supabase_publishable_key="",
        supabase_service_role_key="",
        telemetry_stale_threshold_ms=2000,
    )
    app = create_app(settings)
    database = FakeDatabase()
    bridge = FakeBridge()
    async with app.router.lifespan_context(app):
        manager = ConnectionManager(queue_size=5, max_dropped_messages=2)
        app.state.db_client = database
        app.state.auth_client = FakeAuth()
        app.state.websocket_manager = manager
        app.state.ugv_bridge = bridge
        app.state.telemetry_service = TelemetryService(
            RobotTelemetryRepository(database),  # type: ignore[arg-type]
            MotorTelemetryRepository(database),  # type: ignore[arg-type]
            SafetyEventRepository(database),  # type: ignore[arg-type]
            LocalizationStatusRepository(database),  # type: ignore[arg-type]
            SensorStatusRepository(database),  # type: ignore[arg-type]
            RobotRepository(database),  # type: ignore[arg-type]
            manager,
            stale_threshold_ms=2000,
            persistence_enabled=True,
            persistence_rate_hz=2,
        )
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, app, database, bridge
