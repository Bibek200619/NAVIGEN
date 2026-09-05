from fastapi import APIRouter

from app.api.v1.routes import admin, cameras, commands, logs, missions, robots, system

router = APIRouter()
router.include_router(cameras.router, prefix="/cameras", tags=["cameras"])
router.include_router(system.router, tags=["system"])
router.include_router(robots.router, prefix="/robots", tags=["robots"])
router.include_router(missions.router, prefix="/missions", tags=["missions"])
router.include_router(commands.router, tags=["commands"])
router.include_router(logs.router, prefix="/logs", tags=["logs"])
router.include_router(admin.router, prefix="/admin", tags=["admin"])
