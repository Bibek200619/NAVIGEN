# NAVIGEN UGV — first product demo

A self-contained, local warehouse inspection simulation with a 3D four-wheel UGV,
a simulated front camera, live telemetry, mission controls, and the existing NAVIGEN
operator dashboard. It does not require a robot, ROS, a database, or authentication credentials.

**Everything in this demo is simulated.** The vehicle uses a simple kinematic waypoint
controller and a geometry-based detour planner. This demonstrates the operator experience
and data flow; it does not validate real-world autonomy, perception, SLAM, or vehicle safety.

## Start the presentation

From `web_app/`:

```bash
./simulation/start.sh
```

The launcher installs missing dependencies, starts both servers, and prints the URLs:

- **3D demo:** <http://127.0.0.1:8010>
- **Operator dashboard:** <http://127.0.0.1:5174>

Open the 3D demo and click **Run guided demo**. No login or tokens are needed for the demo
UI. The dashboard starts a clearly marked, local simulation session automatically. The
regular frontend at port 5173 and the physical backend configuration are unaffected.

Keep the launch terminal open. Press **Ctrl+C** there to stop both demo servers.
If a port is already occupied, the launcher stops with a message rather than killing
another process. Startup output is in `simulation/server.log` and `simulation/dashboard.log`.

Prerequisites: Python 3.11+, Node.js/npm, and [uv](https://docs.astral.sh/uv/getting-started/installation/).
The first setup needs internet access. After dependencies are installed, the entire demo
runs locally, including 3D assets and camera rendering. Use a WebGL-capable browser such
as Chrome. A laptop/desktop at 1280 pixels or wider is best for presenting.

## A short presentation script

1. **Introduce the workspace.** “This is NAVIGEN's operator experience. Today's vehicle
   and environment are simulated so we can demonstrate the complete workflow.”
2. **Run guided demo.** The UGV leaves the dock and follows a four-checkpoint inspection
   route. Show position, speed, battery, and the planned route. The full route takes
   approximately one minute on a normally loaded machine.
3. **Show obstacle avoidance.** Around 7 seconds in, the demo places an obstacle ahead.
   The UGV turns around it along the amber detour, then rejoins its inspection route.
   The obstacle stays in place until you clear it or reset. The planner uses known scene
   geometry with vehicle clearance; this is not camera-based obstacle recognition.
   If a checkpoint is completely obstructed and no clear route exists, the UGV waits.
4. **Choose Follow UGV or Driver.** Show the vehicle up close or from its own viewpoint.
   Drag in Overview to orbit the scene; scroll to zoom.
5. **Open operator dashboard.** Show the camera and telemetry. Visit Sensors to see
   the simulated camera, IMU, odometry, transforms, and joint states. Visit Robot to
   show position/heading, Missions for synchronized controls, and Activity for events.
6. **Show completion.** All four checkpoints become reached; the UGV returns to the dock.
7. **Optional manual sequence.** Reset, Start mission, Pause/Resume, Add obstacle, Clear
   path, and Simulated E-stop. An asserted E-stop stays latched until Reset simulation.

Before the audience arrives, use **Reset simulation** to put the UGV back at the dock.
The demo does not start moving until you choose Start mission or Run guided demo.

## What is in this folder

| File | Purpose |
| --- | --- |
| `start.sh` | Starts the simulator and a separate dashboard dev server |
| `engine.py` | Deterministic waypoint motion, obstacle avoidance, E-stop, mission lifecycle |
| `navigation.py` | Visibility graph route planner with clearance for the rover and walls |
| `camera.py` | CPU-rendered 640 × 360 JPEG camera from the vehicle pose |
| `server.py` | Local FastAPI service, state WebSocket, telemetry, MJPEG, commands, logs |
| `static/` | Three.js warehouse, UGV model, camera views, mission controls |
| `tests/test_engine.py` | Deterministic behavior and camera checks |
| `tests/smoke_demo.py` | Full rehearsal against the running demo; resets demo state |
| `pyproject.toml`, `uv.lock` | Isolated, reproducible Python dependencies |
| `package.json`, `package-lock.json` | Local Three.js dependency; no CDN at runtime |

Python dependencies live in `simulation/.venv`, separate from the physical backend.
State is in memory and resets when the simulation server restarts. The camera continues
rendering when you switch tabs; it does not depend on the 3D browser window staying visible.

## API and integration

- `GET /simulation/state`: current simulation state, route, scene geometry, event history.
- `WS /ws/simulation`: state at approximately 10 Hz for the 3D view.
- `POST /simulation/commands`: `demo`, `start`, `pause`, `reset`, `obstacle`,
  `clear_obstacle`, or `estop`.
- `GET /api/v1/cameras/primary`, `GET /api/v1/cameras/primary/stream`: authenticated
  camera metadata and MJPEG at approximately 8 fps.
- `WS /ws/v1/telemetry`: canonical v1 telemetry envelopes and authentication handshake.
- `GET /api/v1/logs`: simulation event history for the dashboard Activity page.
- `GET /simulation/camera.jpg`: latest rendered JPEG for the demo cockpit.

The local demo token is the public constant `navigen-local-simulation`. This is a convenience
boundary for a loopback-only demo, not production authentication. The launcher binds to
`127.0.0.1`; do not expose this service publicly. It never imports or connects to the real
robot bridge or database. The regular backend does not accept this demo token.

Dashboard demo mode is enabled only by `VITE_SIMULATION_MODE=true` in Vite development
mode, with `VITE_API_URL=http://127.0.0.1:8010` and the corresponding WebSocket URL.
Production builds cannot activate the automatic demo session.

## Verify before presenting

```bash
simulation/.venv/bin/python -m unittest discover -s simulation/tests -v
# With ./simulation/start.sh already running:
simulation/.venv/bin/python simulation/tests/smoke_demo.py
```

The full smoke check runs a guided mission, checks authenticated camera delivery,
verifies pause/E-stop, observes the detour with the obstacle still present, waits for all four checkpoints,
and resets the vehicle for presentation. Allow about 60–90 seconds.

If the 3D view does not render, check WebGL support/hardware acceleration. The operator
dashboard, software camera, and backend simulation are independent of browser 3D rendering.
If the dashboard is offline, check both log files and confirm you're opening port **5174**.
