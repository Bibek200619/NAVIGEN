import asyncio
from typing import Any

import httpx
import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.errors import AppError
from app.services.camera_service import CameraService


class Chunks(httpx.AsyncByteStream):
    def __init__(self, chunks: list[bytes]) -> None:
        self.chunks = chunks
        self.closed = False

    async def __aiter__(self):
        for chunk in self.chunks:
            yield chunk

    async def aclose(self) -> None:
        self.closed = True


async def configure_camera(
    app: Any,
    stream: Chunks,
    status: int = 200,
    content_type: str = "multipart/x-mixed-replace; boundary=upstream",
):
    service = app.state.camera_service
    await service.client.aclose()
    service.url = "http://camera.internal/stream"
    service.client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                status, headers={"Content-Type": content_type}, stream=stream
            )
        )
    )
    return service


async def test_camera_requires_authentication(api_context):
    client, _, _, _ = api_context
    for path in ("/api/v1/cameras/primary", "/api/v1/cameras/primary/stream"):
        response = await client.get(path)
        assert response.status_code == 401


async def test_unconfigured_camera_is_explicit(api_context, auth_headers):
    client, _, _, _ = api_context
    response = await client.get("/api/v1/cameras/primary", headers=auth_headers["viewer"])
    assert response.json()["configured"] is False
    response = await client.get("/api/v1/cameras/primary/stream", headers=auth_headers["viewer"])
    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CAMERA_NOT_CONFIGURED"


async def test_stream_reassembles_chunked_jpegs_and_closes(api_context, auth_headers):
    client, app, _, _ = api_context
    first, second = b"\xff\xd8first\xff\xd9", b"\xff\xd8second\xff\xd9"
    stream = Chunks([b"--upstream\r\n\r\n\xff", b"\xd8first\xff", b"\xd9\r\n", second])
    service = await configure_camera(app, stream)
    response = await client.get("/api/v1/cameras/primary/stream", headers=auth_headers["viewer"])
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.content.count(b"--frame") == 2
    assert first in response.content and second in response.content
    assert b"upstream" not in response.content
    assert stream.closed
    assert not service.slots.locked()


@pytest.mark.parametrize(
    "status,content_type", [(503, "text/plain"), (200, "text/html"), (302, "text/html")]
)
async def test_upstream_failure_is_sanitized(api_context, auth_headers, status, content_type):
    client, app, _, _ = api_context
    stream = Chunks([b"private upstream details"])
    await configure_camera(app, stream, status, content_type)
    response = await client.get("/api/v1/cameras/primary/stream", headers=auth_headers["viewer"])
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "CAMERA_UNAVAILABLE"
    assert "camera.internal" not in response.text
    assert "private upstream" not in response.text
    assert stream.closed


async def test_oversized_frame_is_dropped(api_context, auth_headers):
    client, app, _, _ = api_context
    stream = Chunks([b"\xff\xd8" + b"a" * 100 + b"\xff\xd9"])
    service = await configure_camera(app, stream)
    service.max_frame_bytes = 50
    response = await client.get("/api/v1/cameras/primary/stream", headers=auth_headers["viewer"])
    assert response.content == b""
    assert stream.closed


async def test_viewer_limit_and_disconnect_cleanup():
    service = CameraService("http://camera/stream", 1, 1, 1000)
    await service.client.aclose()
    stream = Chunks([b"\xff\xd8frame\xff\xd9"])
    service.client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200, headers={"Content-Type": "multipart/x-mixed-replace"}, stream=stream
            )
        )
    )
    response = await service.open()
    with pytest.raises(AppError, match="viewing slots"):
        await service.open()
    iterator = service.frames(response)
    await anext(iterator)
    await iterator.aclose()
    assert stream.closed
    assert not service.slots.locked()
    await service.close()


async def test_connection_timeout_releases_slot():
    service = CameraService("http://camera/stream", 1, 1, 1000)
    await service.client.aclose()

    def timeout(request):
        raise httpx.ConnectTimeout("private upstream address")

    service.client = httpx.AsyncClient(transport=httpx.MockTransport(timeout))
    with pytest.raises(AppError, match="unavailable"):
        await service.open()
    assert not service.slots.locked()
    await service.close()


async def test_cancelled_open_releases_slot():
    service = CameraService("http://camera/stream", 1, 1, 1000)
    await service.client.aclose()

    async def wait(request):
        await asyncio.sleep(30)
        return httpx.Response(200)

    service.client = httpx.AsyncClient(transport=httpx.MockTransport(wait))
    task = asyncio.create_task(service.open())
    await asyncio.sleep(0)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert not service.slots.locked()
    await service.close()


@pytest.mark.parametrize(
    "url", ["file:///etc/passwd", "rtsp://camera/live", "http://", "https://camera/#x"]
)
def test_camera_source_must_be_http_mjpeg(url):
    with pytest.raises(ValidationError):
        Settings(camera_stream_url=url)


async def test_disconnect_before_iteration_still_closes_upstream():
    from starlette.background import BackgroundTask
    from starlette.responses import StreamingResponse

    service = CameraService("http://camera/stream", 1, 1, 1000)
    await service.client.aclose()
    stream = Chunks([b"\xff\xd8frame\xff\xd9"])
    service.client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200, headers={"Content-Type": "multipart/x-mixed-replace"}, stream=stream
            )
        )
    )
    upstream = await service.open()
    response = StreamingResponse(
        service.frames(upstream), background=BackgroundTask(service.release, upstream)
    )

    async def receive():
        return {"type": "http.disconnect"}

    async def send(message):
        # Disconnect cancels sending headers, before the frame iterator is entered.
        await asyncio.sleep(30)

    await response({"type": "http", "asgi": {"spec_version": "2.3"}}, receive, send)
    assert stream.closed
    assert not service.slots.locked()
    await service.release(upstream)  # Background cleanup and iterator cleanup can overlap.
    assert service.slots._value == 1
    await service.close()
