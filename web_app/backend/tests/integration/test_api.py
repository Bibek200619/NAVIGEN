from datetime import UTC, datetime, timedelta

import pytest

from tests.conftest import ROBOT_ID, FakeDatabase


@pytest.mark.asyncio
async def test_health_and_status(api_context: tuple, auth_headers: dict) -> None:
    client, _, _, _ = api_context
    health = await client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok", "service": "navigen-backend"}
    assert health.headers["X-Request-ID"]

    status = await client.get("/api/v1/status")
    assert status.status_code == 200
    assert status.json() == {
        "status": "ok",
        "version": "1",
        "database": "connected",
        "ugv_bridge": "connected",
    }


@pytest.mark.asyncio
async def test_robots_list_detail_and_auth(api_context: tuple, auth_headers: dict) -> None:
    client, _, _, _ = api_context
    unauthorized = await client.get("/api/v1/robots")
    assert unauthorized.status_code == 401
    assert unauthorized.json()["error"]["code"] == "UNAUTHENTICATED"

    response = await client.get("/api/v1/robots", headers=auth_headers["viewer"])
    assert response.status_code == 200
    assert response.json()["items"][0]["id"] == str(ROBOT_ID)

    detail = await client.get(f"/api/v1/robots/{ROBOT_ID}", headers=auth_headers["viewer"])
    assert detail.status_code == 200
    assert detail.json()["connection_status"] == "connected"


@pytest.mark.asyncio
async def test_mission_create_goal_and_invalid_transition(
    api_context: tuple, auth_headers: dict
) -> None:
    client, _, _, _ = api_context
    payload = {
        "robot_id": str(ROBOT_ID),
        "name": "Obstacle course",
        "goals": [
            {
                "position_x": 1.0,
                "position_y": 2.0,
                "orientation_z": 0.0,
                "orientation_w": 1.0,
            }
        ],
    }
    response = await client.post(
        "/api/v1/missions", json=payload, headers=auth_headers["operator"]
    )
    assert response.status_code == 201
    mission = response.json()
    assert mission["status"] == "pending"
    assert mission["goals"][0]["sequence_no"] == 0

    goal = await client.post(
        f"/api/v1/missions/{mission['id']}/goals",
        json={
            "position_x": 3,
            "position_y": 4,
            "orientation_z": 0,
            "orientation_w": 1,
        },
        headers=auth_headers["operator"],
    )
    assert goal.status_code == 201
    assert goal.json()["sequence_no"] == 1

    completed = await client.patch(
        f"/api/v1/missions/{mission['id']}",
        json={"status": "in_progress"},
        headers=auth_headers["operator"],
    )
    assert completed.status_code == 200
    completed = await client.patch(
        f"/api/v1/missions/{mission['id']}",
        json={"status": "completed"},
        headers=auth_headers["operator"],
    )
    assert completed.status_code == 200
    rejected = await client.patch(
        f"/api/v1/missions/{mission['id']}",
        json={"status": "in_progress"},
        headers=auth_headers["operator"],
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "MISSION_INVALID_STATE"


@pytest.mark.asyncio
async def test_viewer_cannot_create_mission(api_context: tuple, auth_headers: dict) -> None:
    client, _, _, _ = api_context
    response = await client.post(
        "/api/v1/missions",
        json={"robot_id": str(ROBOT_ID), "name": "Denied"},
        headers=auth_headers["viewer"],
    )
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "FORBIDDEN"


def _telemetry(database: FakeDatabase, *, age_seconds: int = 0, safety: str = "ok") -> None:
    now = datetime.now(UTC)
    database.tables["robot_telemetry"] = [
        {
            "id": "30000000-0000-0000-0000-000000000001",
            "robot_id": str(ROBOT_ID),
            "recorded_at": (now - timedelta(seconds=age_seconds)).isoformat(),
            "received_at": now.isoformat(),
            "connection_status": "connected",
            "is_stale": False,
            "data_age_ms": 0,
            "linear_velocity": 0.0,
            "angular_velocity": 0.0,
            "battery_level_pct": 80,
            "safety_state": safety,
            "localization_state": "tracking",
            "created_at": now.isoformat(),
        }
    ]


def _goal_command() -> dict:
    return {
        "command_type": "set_goal",
        "payload": {
            "frame_id": "map",
            "position": {"x": 1, "y": 2, "z": 0},
            "orientation": {"x": 0, "y": 0, "z": 0, "w": 1},
        },
    }


@pytest.mark.asyncio
async def test_command_create_and_idempotency(api_context: tuple, auth_headers: dict) -> None:
    client, _, database, bridge = api_context
    _telemetry(database)
    headers = {**auth_headers["operator"], "Idempotency-Key": "goal-request-0001"}
    first = await client.post(
        f"/api/v1/robots/{ROBOT_ID}/commands", json=_goal_command(), headers=headers
    )
    second = await client.post(
        f"/api/v1/robots/{ROBOT_ID}/commands", json=_goal_command(), headers=headers
    )
    assert first.status_code == 202
    assert first.json()["status"] == "accepted"
    assert second.json()["id"] == first.json()["id"]
    assert len(bridge.goals) == 1


@pytest.mark.asyncio
async def test_viewer_command_rejected_by_authorization(
    api_context: tuple, auth_headers: dict
) -> None:
    client, _, database, bridge = api_context
    _telemetry(database)
    response = await client.post(
        f"/api/v1/robots/{ROBOT_ID}/commands",
        json=_goal_command(),
        headers=auth_headers["viewer"],
    )
    assert response.status_code == 403
    assert not bridge.goals


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("age_seconds", "safety", "reason"),
    [(5, "ok", "ROBOT_TELEMETRY_STALE"), (0, "warning", "ROBOT_UNSAFE")],
)
async def test_motion_command_safety_rejections(
    api_context: tuple,
    auth_headers: dict,
    age_seconds: int,
    safety: str,
    reason: str,
) -> None:
    client, _, database, bridge = api_context
    _telemetry(database, age_seconds=age_seconds, safety=safety)
    response = await client.post(
        f"/api/v1/robots/{ROBOT_ID}/commands",
        json=_goal_command(),
        headers=auth_headers["operator"],
    )
    assert response.status_code == 202
    assert response.json()["status"] == "rejected"
    assert response.json()["rejection_reason"] == reason
    assert not bridge.goals


@pytest.mark.asyncio
async def test_software_estop_only_allows_assertion(api_context: tuple, auth_headers: dict) -> None:
    client, _, _, bridge = api_context
    rejected = await client.post(
        f"/api/v1/robots/{ROBOT_ID}/commands",
        json={"command_type": "software_estop", "payload": {"active": False}},
        headers=auth_headers["operator"],
    )
    assert rejected.json()["rejection_reason"] == "COMMAND_REJECTED"
    assert not bridge.estops
    accepted = await client.post(
        f"/api/v1/robots/{ROBOT_ID}/commands",
        json={"command_type": "software_estop", "payload": {"active": True}},
        headers=auth_headers["operator"],
    )
    assert accepted.json()["status"] == "accepted"
    assert bridge.estops == [True]


@pytest.mark.asyncio
async def test_validation_error_uses_stable_envelope(api_context: tuple) -> None:
    client, _, _, _ = api_context
    request_id = "40000000-0000-0000-0000-000000000001"
    response = await client.get(
        "/api/v1/robots/not-a-uuid",
        headers={"Authorization": "Bearer viewer-token", "X-Request-ID": request_id},
    )
    assert response.status_code == 422
    assert response.json()["error"]["request_id"] == request_id
    assert response.headers["X-Request-ID"] == request_id
