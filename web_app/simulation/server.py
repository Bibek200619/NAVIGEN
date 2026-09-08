"""Local-only product simulator. Independent from the real robot backend."""

import asyncio
import contextlib
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated, Literal

from camera import render_camera
from engine import ROBOT_ID, Simulation, now
from environments import TerrainConfig, catalog
from fastapi import (
    Depends,
    FastAPI,
    HTTPException,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict

ROOT = Path(__file__).resolve().parent
DEMO_TOKEN = "navigen-local-simulation"
sim = Simulation()
bearer = HTTPBearer(auto_error=False)
frame = b""
frame_version = 0
frame_ready = asyncio.Condition()


async def ticker():
    previous = time.monotonic()
    while True:
        current = time.monotonic()
        sim.step(current - previous)
        previous = current
        await asyncio.sleep(1 / 30)


async def camera_ticker():
    global frame, frame_version
    while True:
        rendered = await asyncio.to_thread(render_camera, sim.snapshot())
        async with frame_ready:
            frame = rendered
            frame_version += 1
            frame_ready.notify_all()
        await asyncio.sleep(0.12)


@asynccontextmanager
async def lifespan(app):
    tasks = [asyncio.create_task(ticker()), asyncio.create_task(camera_ticker())]
    yield
    for task in tasks:
        task.cancel()
    for task in tasks:
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="NAVIGEN Local Simulation", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        f"http://{host}:{port}"
        for host in ("localhost", "127.0.0.1")
        for port in (5173, 5174, 8010)
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


def authorized(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
):
    if credentials is None or credentials.credentials != DEMO_TOKEN:
        raise HTTPException(401, "A local simulation session is required.")


@app.exception_handler(HTTPException)
async def error(request, exc):
    return JSONResponse(
        {"error": {"message": str(exc.detail), "code": "SIMULATION_ERROR"}},
        status_code=exc.status_code,
    )


@app.get("/")
async def index():
    return FileResponse(ROOT / "static/index.html")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "navigen-simulation", "simulation": True}


@app.get("/simulation/state")
async def state():
    return sim.snapshot()


class EnvironmentSelection(BaseModel):
    model_config = ConfigDict(extra="forbid")
    environment_id: Literal["mountain", "rocky", "forest", "custom"]
    config: TerrainConfig | None = None


@app.get("/simulation/environments")
async def environments():
    return {"presets": catalog(), "custom": sim.custom_config.model_dump()}


@app.post("/simulation/environment", dependencies=[Depends(authorized)])
async def select_environment(selection: EnvironmentSelection):
    return sim.select_environment(
        selection.environment_id,
        selection.config.model_dump() if selection.config else None,
    )


class Command(BaseModel):
    action: Literal[
        "demo", "start", "pause", "reset", "obstacle", "clear_obstacle", "estop"
    ]


@app.post("/simulation/commands", dependencies=[Depends(authorized)])
async def command(command: Command):
    try:
        return sim.command(command.action)
    except ValueError as exc:
        raise HTTPException(409, str(exc)) from exc


@app.get("/api/v1/cameras/primary", dependencies=[Depends(authorized)])
async def camera_status():
    return {
        "camera_id": "primary",
        "name": "Simulated front camera",
        "configured": True,
        "transport": "mjpeg",
        "simulation": True,
    }


@app.get("/api/v1/cameras/primary/stream", dependencies=[Depends(authorized)])
async def camera_stream():
    async def frames():
        seen = -1
        while True:
            async with frame_ready:
                await asyncio.wait_for(
                    frame_ready.wait_for(
                        lambda seen=seen: frame_version != seen and bool(frame)
                    ),
                    5,
                )
                image = frame
                seen = frame_version
            yield (
                b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
                + str(len(image)).encode()
                + b"\r\n\r\n"
                + image
                + b"\r\n"
            )

    return StreamingResponse(
        frames(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@app.get("/simulation/camera.jpg")
async def snapshot():
    from fastapi.responses import Response

    if not frame:
        raise HTTPException(503, "Camera starting.")
    return Response(
        frame, media_type="image/jpeg", headers={"Cache-Control": "no-store"}
    )


@app.get("/api/v1/logs", dependencies=[Depends(authorized)])
async def logs(limit: int = 100, offset: int = 0):
    rows = list(sim.events)
    return {
        "items": rows[max(0, offset) : max(0, offset) + min(max(limit, 1), 100)],
        "total": len(rows),
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/v1/missions", dependencies=[Depends(authorized)])
async def missions():
    status = (
        "completed"
        if sim.status == "completed"
        else "pending"
        if sim.status == "idle"
        else "in_progress"
    )
    return {
        "items": [
            {
                "id": "demo-inspection",
                "robot_id": ROBOT_ID,
                "name": f"{sim.environment['name']} patrol",
                "status": status,
                "simulation": True,
            }
        ],
        "total": 1,
        "limit": 50,
        "offset": 0,
    }


def envelope(event, payload):
    timestamp = now()
    return {
        "schema_version": 1,
        "event_type": event,
        "robot_id": ROBOT_ID,
        "recorded_at": timestamp,
        "received_at": timestamp,
        "payload": payload,
    }


@app.websocket("/ws/simulation")
async def simulation_socket(socket: WebSocket):
    await socket.accept()
    try:
        while True:
            await socket.send_json(sim.snapshot())
            await asyncio.sleep(0.1)
    except (WebSocketDisconnect, RuntimeError):
        pass


@app.websocket("/ws/v1/telemetry")
async def telemetry(socket: WebSocket):
    await socket.accept()
    try:
        auth = await asyncio.wait_for(socket.receive_json(), 5)
        if auth.get("type") != "authenticate" or auth.get("access_token") != DEMO_TOKEN:
            await socket.close(code=4401)
            return
        await socket.send_json({"type": "authenticated", "schema_version": 1})
        sensors = [
            ("Camera", "/camera/image_raw", 8),
            ("Inertial measurement", "/imu/data", 50),
            ("Wheel odometry", "/wheel/odom", 30),
            ("Transforms", "/tf", 30),
            ("Joint states", "/joint_states", 30),
        ]

        async def receive():
            while True:
                message = await socket.receive_json()
                if message.get("type") == "subscribe":
                    await socket.send_json(
                        {
                            "type": "subscribed",
                            "schema_version": 1,
                            "robot_ids": [ROBOT_ID],
                        }
                    )

        listener = asyncio.create_task(receive())
        try:
            index = 0
            while not listener.done():
                await socket.send_json(envelope("robot.telemetry", sim.telemetry()))
                await asyncio.sleep(0.06)
                name, topic, hz = sensors[index % len(sensors)]
                await socket.send_json(
                    envelope(
                        "sensor.status",
                        {
                            "name": name,
                            "topic": topic,
                            "is_active": True,
                            "frequency_hz": hz,
                            "simulation": True,
                        },
                    )
                )
                index += 1
                await asyncio.sleep(0.04)
        finally:
            listener.cancel()
            with contextlib.suppress(asyncio.CancelledError, WebSocketDisconnect):
                await listener
    except (WebSocketDisconnect, RuntimeError, TimeoutError, ValueError):
        pass


app.mount("/static", StaticFiles(directory=ROOT / "static"), name="static")
app.mount(
    "/vendor", StaticFiles(directory=ROOT / "node_modules/three/build"), name="three"
)
