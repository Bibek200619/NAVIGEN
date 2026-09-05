import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator, Mapping
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.router import router as api_v1_router
from app.core.config import Settings, get_settings
from app.core.constants import SERVICE_NAME
from app.core.errors import AppError
from app.core.logging import configure_logging
from app.core.middleware import RequestIdMiddleware, request_id_from
from app.db.client import SupabaseAuthClient, SupabaseDatabaseClient
from app.repositories.robots import RobotRepository
from app.repositories.system_logs import SystemLogRepository
from app.repositories.telemetry import (
    LocalizationStatusRepository,
    MotorTelemetryRepository,
    RobotTelemetryRepository,
    SafetyEventRepository,
    SensorStatusRepository,
)
from app.services.audit_service import AuditService
from app.services.camera_service import CameraService
from app.services.telemetry_service import TelemetryService
from app.ugv_integration.bridge import RosbridgeUGVBridge
from app.ugv_integration.ingestion import UGVIngestionCoordinator
from app.websocket.manager import ConnectionManager
from app.websocket.routes import router as websocket_router

logger = logging.getLogger(__name__)


def _error_response(
    request: Request,
    *,
    status_code: int,
    code: str,
    message: str,
    details: Mapping[str, object] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": jsonable_encoder(details or {}),
                "request_id": request_id_from(request),
            }
        },
    )


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or get_settings()
    configure_logging(app_settings.debug)

    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        database = SupabaseDatabaseClient(
            app_settings.supabase_url,
            app_settings.supabase_service_role_key.get_secret_value(),
        )
        auth = SupabaseAuthClient(
            app_settings.supabase_url,
            app_settings.supabase_publishable_key.get_secret_value(),
        )
        manager = ConnectionManager(
            queue_size=app_settings.websocket_queue_size,
            max_dropped_messages=app_settings.websocket_max_dropped_messages,
        )
        bridge = RosbridgeUGVBridge(
            app_settings.ugv_bridge_url,
            timeout_seconds=app_settings.ugv_connection_timeout_seconds,
        )
        application.state.settings = app_settings
        camera = CameraService(
            app_settings.camera_stream_url, app_settings.camera_timeout_seconds,
            app_settings.camera_max_viewers, app_settings.camera_max_frame_bytes,
        )
        application.state.camera_service = camera
        application.state.db_client = database
        application.state.auth_client = auth
        application.state.websocket_manager = manager
        application.state.ugv_bridge = bridge
        application.state.telemetry_service = TelemetryService(
            RobotTelemetryRepository(database),
            MotorTelemetryRepository(database),
            SafetyEventRepository(database),
            LocalizationStatusRepository(database),
            SensorStatusRepository(database),
            RobotRepository(database),
            manager,
            stale_threshold_ms=app_settings.telemetry_stale_threshold_ms,
            persistence_enabled=app_settings.telemetry_persistence_enabled,
            persistence_rate_hz=app_settings.telemetry_persistence_rate_hz,
        )
        ingestion: UGVIngestionCoordinator | None = None
        ingestion_task: asyncio.Task[None] | None = None
        if app_settings.ugv_robot_id is not None:
            ingestion = UGVIngestionCoordinator(
                app_settings.ugv_robot_id,
                bridge,
                application.state.telemetry_service,
                AuditService(SystemLogRepository(database)),
                localization_topic=app_settings.ugv_localization_topic,
            )
            ingestion_task = asyncio.create_task(ingestion.run())
        try:
            yield
        finally:
            await camera.close()
            if ingestion is not None:
                await ingestion.stop()
            else:
                await bridge.disconnect()
            if ingestion_task is not None:
                ingestion_task.cancel()
                with contextlib.suppress(asyncio.CancelledError):
                    await ingestion_task
            await auth.close()
            await database.close()

    application = FastAPI(
        title=app_settings.app_name,
        version="1.0.0",
        debug=app_settings.debug,
        lifespan=lifespan,
    )
    application.add_middleware(RequestIdMiddleware)
    application.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.frontend_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    application.include_router(api_v1_router, prefix=app_settings.api_v1_prefix)
    application.include_router(websocket_router)

    @application.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "service": SERVICE_NAME}

    @application.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
        return _error_response(
            request,
            status_code=exc.status_code,
            code=exc.code,
            message=exc.message,
            details=exc.details,
        )

    @application.exception_handler(RequestValidationError)
    async def validation_error_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return _error_response(
            request,
            status_code=422,
            code="VALIDATION_ERROR",
            message="The request failed validation.",
            details={"errors": exc.errors()},
        )

    @application.exception_handler(StarletteHTTPException)
    async def http_error_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR"
        return _error_response(
            request, status_code=exc.status_code, code=code, message=str(exc.detail)
        )

    @application.exception_handler(Exception)
    async def unexpected_error_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled request error", extra={"event_code": "INTERNAL_ERROR"})
        return _error_response(
            request,
            status_code=500,
            code="INTERNAL_ERROR",
            message="An unexpected server error occurred.",
        )

    return application

app = create_app()
