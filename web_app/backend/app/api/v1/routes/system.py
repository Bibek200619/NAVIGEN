from fastapi import APIRouter

router = APIRouter()


@router.get("/status")
async def system_status() -> dict[str, object]:
    return {"service": "navigen-backend", "schema_version": 1, "status": "ok"}
