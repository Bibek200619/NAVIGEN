from fastapi import APIRouter, Request

from app.core.constants import API_VERSION

router = APIRouter()


@router.get("/status")
async def system_status(request: Request) -> dict[str, str]:
    database_connected = await request.app.state.db_client.health()
    bridge_connected = await request.app.state.ugv_bridge.health()
    return {
        "status": "ok",
        "version": API_VERSION,
        "database": "connected" if database_connected else "disconnected",
        "ugv_bridge": "connected" if bridge_connected else "disconnected",
    }
