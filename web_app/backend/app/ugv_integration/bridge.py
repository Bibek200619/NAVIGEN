import asyncio
import contextlib
import json
import logging
from collections.abc import Awaitable, Callable, Mapping
from typing import Protocol

from websockets.asyncio.client import ClientConnection, connect
from websockets.exceptions import ConnectionClosed, WebSocketException

from app.core.errors import AppError, UGVBridgeError
from app.core.types import JsonValue
from app.schemas.command import SetGoalPayload
from app.ugv_integration.mappers import goal_to_ros_message
from app.ugv_integration.topics import GOAL_POSE_TOPIC, SOFTWARE_ESTOP_TOPIC

logger = logging.getLogger(__name__)
MessageHandler = Callable[[Mapping[str, object]], Awaitable[None]]


class UGVBridge(Protocol):
    async def connect(self) -> None: ...
    async def disconnect(self) -> None: ...
    async def send_goal(self, payload: SetGoalPayload) -> Mapping[str, JsonValue]: ...
    async def set_software_estop(self, active: bool) -> Mapping[str, JsonValue]: ...
    async def health(self) -> bool: ...


class RosbridgeUGVBridge:
    """Minimal rosbridge transport boundary.

    This transport publishes canonical ROS messages. A production deployment still
    requires a tested `/goal_pose` adapter on the UGV side.
    """

    def __init__(
        self,
        url: str,
        *,
        timeout_seconds: float,
        connector: Callable[..., Awaitable[ClientConnection]] = connect,
    ) -> None:
        self.url = url
        self.timeout_seconds = timeout_seconds
        self._connector = connector
        self._socket: ClientConnection | None = None
        self._lock = asyncio.Lock()
        self._send_lock = asyncio.Lock()
        self._handlers: dict[str, list[MessageHandler]] = {}
        self._incoming: asyncio.Queue[tuple[str, Mapping[str, object]]] = asyncio.Queue(
            maxsize=256
        )
        self._receiver_task: asyncio.Task[None] | None = None
        self._worker_task: asyncio.Task[None] | None = None
        self._disconnected = asyncio.Event()
        self._disconnected.set()

    def add_message_handler(self, topic: str, handler: MessageHandler) -> None:
        self._handlers.setdefault(topic, []).append(handler)

    async def connect(self) -> None:
        if await self.health():
            return
        async with self._lock:
            if await self.health():
                return
            try:
                self._socket = await asyncio.wait_for(
                    self._connector(self.url, open_timeout=self.timeout_seconds),
                    timeout=self.timeout_seconds,
                )
                self._disconnected.clear()
                await self._advertise(GOAL_POSE_TOPIC, "geometry_msgs/msg/PoseStamped")
                await self._advertise(SOFTWARE_ESTOP_TOPIC, "std_msgs/msg/Bool")
                for topic in self._handlers:
                    await self._send({"op": "subscribe", "topic": topic})
                self._receiver_task = asyncio.create_task(self._receive_messages())
                self._worker_task = asyncio.create_task(self._dispatch_messages())
            except (OSError, TimeoutError, WebSocketException) as exc:
                socket, self._socket = self._socket, None
                self._disconnected.set()
                if socket is not None:
                    await socket.close()
                raise UGVBridgeError() from exc

    async def disconnect(self) -> None:
        socket, self._socket = self._socket, None
        self._disconnected.set()
        tasks = (self._receiver_task, self._worker_task)
        self._receiver_task = None
        self._worker_task = None
        for task in tasks:
            if task is not None and task is not asyncio.current_task():
                task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await task
        if socket is not None:
            await socket.close()

    async def health(self) -> bool:
        return self._socket is not None and self._socket.state.name == "OPEN"

    async def wait_until_disconnected(self) -> None:
        await self._disconnected.wait()

    async def send_goal(self, payload: SetGoalPayload) -> Mapping[str, JsonValue]:
        await self._publish(GOAL_POSE_TOPIC, goal_to_ros_message(payload))
        return {"topic": GOAL_POSE_TOPIC, "published": True}

    async def set_software_estop(self, active: bool) -> Mapping[str, JsonValue]:
        if not active:
            raise UGVBridgeError("Remote software e-stop release is not permitted.")
        await self._publish(SOFTWARE_ESTOP_TOPIC, {"data": True})
        return {"topic": SOFTWARE_ESTOP_TOPIC, "published": True, "active": True}

    async def _advertise(self, topic: str, message_type: str) -> None:
        await self._send({"op": "advertise", "topic": topic, "type": message_type})

    async def _publish(self, topic: str, message: Mapping[str, JsonValue]) -> None:
        if not await self.health():
            await self.connect()
        await self._send({"op": "publish", "topic": topic, "msg": dict(message)})

    async def _send(self, payload: Mapping[str, JsonValue]) -> None:
        if self._socket is None:
            raise UGVBridgeError()
        try:
            async with self._send_lock:
                await asyncio.wait_for(
                    self._socket.send(json.dumps(payload, separators=(",", ":"))),
                    timeout=self.timeout_seconds,
                )
        except (OSError, TimeoutError, WebSocketException) as exc:
            await self.disconnect()
            raise UGVBridgeError() from exc

    async def _receive_messages(self) -> None:
        socket = self._socket
        if socket is None:
            return
        try:
            async for raw in socket:
                raw_text = raw.decode("utf-8") if isinstance(raw, bytes) else raw
                parsed: object = json.loads(raw_text)
                if not isinstance(parsed, dict) or parsed.get("op") != "publish":
                    continue
                topic = parsed.get("topic")
                message = parsed.get("msg")
                if not isinstance(topic, str) or not isinstance(message, dict):
                    continue
                item = (topic, message)
                try:
                    self._incoming.put_nowait(item)
                except asyncio.QueueFull:
                    with contextlib.suppress(asyncio.QueueEmpty):
                        self._incoming.get_nowait()
                    with contextlib.suppress(asyncio.QueueFull):
                        self._incoming.put_nowait(item)
        except (ConnectionClosed, OSError, ValueError):
            logger.warning(
                "UGV bridge receive loop stopped",
                extra={"source": "ugv_bridge", "event_code": "UGV_BRIDGE_DISCONNECTED"},
            )
        finally:
            if self._socket is socket:
                self._socket = None
                self._disconnected.set()
            worker = self._worker_task
            if worker is not None and worker is not asyncio.current_task():
                worker.cancel()

    async def _dispatch_messages(self) -> None:
        while True:
            topic, message = await self._incoming.get()
            for handler in self._handlers.get(topic, ()):
                try:
                    await handler(message)
                except (ValueError, TypeError, AppError):
                    logger.exception(
                        "Malformed UGV message rejected",
                        extra={"source": "ugv_bridge", "event_code": "UGV_MESSAGE_INVALID"},
                    )
