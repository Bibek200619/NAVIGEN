import asyncio
from collections.abc import AsyncIterator

import httpx

from app.core.errors import AppError


class CameraService:
    """Bounded, read-only relay of the operator-configured MJPEG source."""

    def __init__(self, url: str, timeout: float, max_viewers: int, max_frame_bytes: int) -> None:
        self.url = url
        self.max_frame_bytes = max_frame_bytes
        self.slots = asyncio.Semaphore(max_viewers)
        self._responses: set[httpx.Response] = set()
        self.client = httpx.AsyncClient(
            timeout=httpx.Timeout(timeout), follow_redirects=False, trust_env=False
        )

    async def open(self) -> httpx.Response:
        if not self.url:
            raise AppError(
                "CAMERA_NOT_CONFIGURED", "The camera source is not configured.", status_code=503
            )
        if self.slots.locked():
            raise AppError("CAMERA_BUSY", "All camera viewing slots are in use.", status_code=503)
        await self.slots.acquire()
        response = None
        try:
            response = await self.client.send(
                self.client.build_request(
                    "GET", self.url, headers={"Accept": "multipart/x-mixed-replace"}
                ),
                stream=True,
            )
            response.raise_for_status()
            if (
                not response.headers.get("content-type", "")
                .lower()
                .startswith("multipart/x-mixed-replace")
            ):
                raise ValueError("Expected MJPEG")
            self._responses.add(response)
            return response
        except BaseException as exc:
            if response is not None:
                await response.aclose()
            self.slots.release()
            if isinstance(exc, (httpx.HTTPError, ValueError)):
                raise AppError(
                    "CAMERA_UNAVAILABLE", "The camera source is unavailable.", status_code=502
                ) from None
            raise

    async def frames(self, response: httpx.Response) -> AsyncIterator[bytes]:
        # Normalize multipart boundaries and discard headers from the private upstream.
        buffer = bytearray()
        try:
            async for chunk in response.aiter_bytes():
                buffer.extend(chunk)
                while True:
                    start = buffer.find(b"\xff\xd8")
                    if start < 0:
                        if len(buffer) > self.max_frame_bytes:
                            return
                        break
                    if start:
                        del buffer[:start]
                    end = buffer.find(b"\xff\xd9", 2)
                    if end < 0:
                        if len(buffer) > self.max_frame_bytes:
                            return
                        break
                    if end + 2 > self.max_frame_bytes:
                        return
                    frame = bytes(buffer[: end + 2])
                    del buffer[: end + 2]
                    yield (
                        b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                        + str(len(frame)).encode()
                        + b"\r\n\r\n"
                        + frame
                        + b"\r\n"
                    )
        except httpx.HTTPError:
            # The response has started; closing tells the viewer to reconnect.
            return
        finally:
            await self.release(response)

    async def release(self, response: httpx.Response) -> None:
        """Idempotent cleanup, including responses cancelled before iteration starts."""
        if response not in self._responses:
            return
        self._responses.remove(response)
        try:
            await response.aclose()
        finally:
            self.slots.release()

    async def close(self) -> None:
        for response in tuple(self._responses):
            await self.release(response)
        await self.client.aclose()
