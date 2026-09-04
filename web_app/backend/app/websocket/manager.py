import asyncio
import contextlib
import logging
from dataclasses import dataclass, field
from uuid import UUID

from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect

from app.websocket.events import WebSocketEvent

logger = logging.getLogger(__name__)


@dataclass(eq=False, slots=True)
class ClientSubscription:
    websocket: WebSocket
    queue: asyncio.Queue[dict[str, object]]
    robot_ids: set[UUID] = field(default_factory=set)
    dropped_messages: int = 0
    sender_task: asyncio.Task[None] | None = None


class ConnectionManager:
    def __init__(self, *, queue_size: int = 100, max_dropped_messages: int = 25) -> None:
        self.queue_size = queue_size
        self.max_dropped_messages = max_dropped_messages
        self._clients: set[ClientSubscription] = set()
        self._lock = asyncio.Lock()

    @property
    def connection_count(self) -> int:
        return len(self._clients)

    async def connect(self, websocket: WebSocket) -> ClientSubscription:
        client = ClientSubscription(websocket, asyncio.Queue(maxsize=self.queue_size))
        async with self._lock:
            self._clients.add(client)
        client.sender_task = asyncio.create_task(self._sender(client))
        return client

    async def disconnect(self, client: ClientSubscription, *, close_socket: bool = False) -> None:
        async with self._lock:
            self._clients.discard(client)
        task = client.sender_task
        if task is not None and task is not asyncio.current_task():
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task
        if close_socket:
            with contextlib.suppress(RuntimeError):
                await client.websocket.close(code=1013, reason="client too slow")

    def subscribe(self, client: ClientSubscription, robot_ids: set[UUID]) -> None:
        client.robot_ids = set(robot_ids)

    async def broadcast(self, event: WebSocketEvent) -> None:
        message = event.model_dump(mode="json")
        async with self._lock:
            clients = tuple(self._clients)
        for client in clients:
            if (
                event.robot_id is not None
                and client.robot_ids
                and event.robot_id not in client.robot_ids
            ):
                continue
            try:
                client.queue.put_nowait(message)
            except asyncio.QueueFull:
                with contextlib.suppress(asyncio.QueueEmpty):
                    client.queue.get_nowait()
                client.dropped_messages += 1
                with contextlib.suppress(asyncio.QueueFull):
                    client.queue.put_nowait(message)
                if client.dropped_messages >= self.max_dropped_messages:
                    asyncio.create_task(self.disconnect(client, close_socket=True))

    async def _sender(self, client: ClientSubscription) -> None:
        try:
            while True:
                message = await client.queue.get()
                await client.websocket.send_json(message)
        except (WebSocketDisconnect, RuntimeError):
            await self.disconnect(client)
