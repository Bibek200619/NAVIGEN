from typing import Annotated

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from app.api.dependencies import require_authenticated
from app.core.security import CurrentUser
from app.services.camera_service import CameraService

router = APIRouter()


class CameraResponse(BaseModel):
    camera_id: str = "primary"
    name: str = "Front camera"
    configured: bool
    transport: str = "mjpeg"


@router.get("/primary", response_model=CameraResponse)
async def camera_status(
    request: Request, _: Annotated[CurrentUser, Depends(require_authenticated)]
) -> CameraResponse:
    return CameraResponse(configured=bool(request.app.state.camera_service.url))


@router.get("/primary/stream")
async def camera_stream(
    request: Request, _: Annotated[CurrentUser, Depends(require_authenticated)]
) -> StreamingResponse:
    service: CameraService = request.app.state.camera_service
    upstream = await service.open()
    return StreamingResponse(
        service.frames(upstream),
        background=BackgroundTask(service.release, upstream),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
        },
    )
