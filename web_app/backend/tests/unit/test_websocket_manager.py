import asyncio
from datetime import UTC, datetime
from uuid import UUID

import pytest

from app.core.constants import WebSocketEventType
from app.websocket.events import WebSocketEvent
from app.websocket.manager import ConnectionManager

ROBOT_A = UUID("50000000-0000-0000-0000-000000000001")
ROBOT_B = UUID("50000000-0000-0000-0000-000000000002")


class FakeWebSocket:
    def __init__(self, *, broken: bool = False) -> None:
        self.sent: list[dict[str, object]] = []
        self.closed = False
        self.broken = broken

    async def send_json(self, message: dict[str, object]) -> None:
        if self.broken:
            raise RuntimeError("broken client")
        self.sent.append(message)

    async def close(self, code: int, reason: str) -> None:
        del code, reason
        self.closed = True


def event(robot_id: UUID) -> WebSocketEvent:
    now = datetime.now(UTC)
    return WebSocketEvent(
        event_type=WebSocketEventType.ROBOT_TELEMETRY,
        robot_id=robot_id,
        recorded_at=now,
        received_at=now,
        payload={"linear_velocity": 0.1},
    )


@pytest.mark.asyncio
async def test_connect_receive_filter_and_disconnect() -> None:
    manager = ConnectionManager(queue_size=5)
    socket = FakeWebSocket()
    client = await manager.connect(socket)  # type: ignore[arg-type]
    manager.subscribe(client, {ROBOT_A})
    await manager.broadcast(event(ROBOT_B))
    await manager.broadcast(event(ROBOT_A))
    await asyncio.sleep(0)
    assert len(socket.sent) == 1
    assert socket.sent[0]["robot_id"] == str(ROBOT_A)
    await manager.disconnect(client)
    assert manager.connection_count == 0


@pytest.mark.asyncio
async def test_broken_client_is_cleaned_up() -> None:
    manager = ConnectionManager(queue_size=5)
    client = await manager.connect(FakeWebSocket(broken=True))  # type: ignore[arg-type]
    await manager.broadcast(event(ROBOT_A))
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert manager.connection_count == 0
    await manager.disconnect(client)


@pytest.mark.asyncio
async def test_slow_client_queue_is_bounded_and_removed() -> None:
    manager = ConnectionManager(queue_size=1, max_dropped_messages=1)
    socket = FakeWebSocket()
    client = await manager.connect(socket)  # type: ignore[arg-type]
    assert client.sender_task is not None
    client.sender_task.cancel()
    await asyncio.gather(client.sender_task, return_exceptions=True)
    await manager.broadcast(event(ROBOT_A))
    await manager.broadcast(event(ROBOT_A))
    await asyncio.sleep(0)
    assert manager.connection_count == 0
    assert socket.closed is True
