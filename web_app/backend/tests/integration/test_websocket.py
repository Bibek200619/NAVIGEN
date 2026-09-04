from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from tests.conftest import ROBOT_ID, FakeAuth, FakeDatabase


def test_websocket_authenticate_subscribe_and_cleanup() -> None:
    app = create_app(Settings(app_env="test"))
    with TestClient(app) as client:
        app.state.db_client = FakeDatabase()
        app.state.auth_client = FakeAuth()
        manager = app.state.websocket_manager
        with client.websocket_connect("/ws/v1/telemetry") as websocket:
            websocket.send_json(
                {"type": "authenticate", "access_token": "viewer-token"}
            )
            assert websocket.receive_json() == {
                "type": "authenticated",
                "schema_version": 1,
            }
            websocket.send_json({"type": "subscribe", "robot_ids": [str(ROBOT_ID)]})
            subscribed = websocket.receive_json()
            assert subscribed["type"] == "subscribed"
            assert subscribed["robot_ids"] == [str(ROBOT_ID)]
            assert manager.connection_count == 1
        assert manager.connection_count == 0


def test_websocket_rejects_invalid_token() -> None:
    app = create_app(Settings(app_env="test"))
    with TestClient(app) as client:
        app.state.db_client = FakeDatabase()
        app.state.auth_client = FakeAuth()
        with client.websocket_connect("/ws/v1/telemetry") as websocket:
            websocket.send_json({"type": "authenticate", "access_token": "invalid"})
            message = websocket.receive()
            assert message["type"] == "websocket.close"
            assert message["code"] == 4401
