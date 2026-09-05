# NAVIGEN off-road UGV demo

A local 3D simulation of a compact four-wheel UGV patrolling uneven ground. Select
**Mountain**, **Rocky ground**, or **Forest**, or generate a **Custom** environment.
The simulated camera, vehicle attitude, and terrain mesh share the same height field.

## Run

From `web_app/`:

```bash
./simulation/start.sh
```

- 3D simulator: <http://127.0.0.1:8010>
- Operator dashboard: <http://127.0.0.1:5174>

Choose a terrain, then **Run guided demo**. Around seven seconds into the patrol,
a rock appears ahead. The rover takes an amber detour, leaves the rock in place,
and completes all four checkpoints before returning to base camp. Preset missions
usually take 1–2 minutes. Low-grip custom terrain can take longer.

Switching environments resets the patrol at base camp for every connected viewer.
Reset retains the selected environment. **Pause** holds the pose; **Simulated E-stop**
latches until reset or a new environment/demo is explicitly started.
Use **Overview**, **Follow UGV**, or **Driver** to change views. Drag to orbit and
scroll to zoom. Space pauses/resumes; R resets when a form control is not focused.

Keep the launch terminal open; Ctrl+C stops both demo servers. The launcher does
not stop unrelated processes when a port is occupied. Logs are in `server.log` and
`dashboard.log`. Python dependencies are isolated in `simulation/.venv`.

Prerequisites: Python 3.11+, Node.js/npm, and uv. Initial dependency installation
needs internet access; subsequent runs use local assets and do not require ROS,
a physical robot, a database, credentials, or a third-party map service.

## Environments

| Preset | Ground | Conditions |
| --- | --- | --- |
| Alpine ridge | Elevated ridges and boulders | Clear, moderate grip |
| Rocky badlands | Undulating sandstone and rough gravel | Clear, reduced grip |
| Forest trail | Rolling woodland and tree obstacles | Mist, damp soil |

Each field covers 48 × 40 metres. Terrain changes elevation, pitch, roll, driving
speed, and estimated battery consumption. Individual wheels follow the ground;
rain reduces effective grip and changes visibility. Rocks and tree trunks are
included in collision geometry. The generated patrol corridor stays traversable.

## Custom terrain

Click **Custom**, choose a name, terrain type, weather, height scale, roughness,
rock/tree count, surface grip, and seed, then **Generate & switch**.

- The same settings and seed reproduce the same terrain and object placement.
- **Save setup** downloads a versioned JSON settings file.
- **Load setup** validates and applies an exported settings file.
- A generated custom setup is remembered in the browser, and the active server
  remembers it while switching between presets. Server state resets on restart.
- These controls generate procedural terrain; importing elevation maps or drawing
  an arbitrary route is not implemented.

## Estimated rover model

These are presentation assumptions, not measured specifications of a real UGV:

| Parameter | Estimate / model |
| --- | --- |
| Layout | Four driven wheels, differential steering |
| Overall length / width | Approximately 1.6 m / 1.3 m |
| Wheel diameter | 0.60 m |
| Wheelbase / track | 0.86 m / 1.06 m |
| Body clearance | Approximately 0.36 m |
| Camera height | 1.25 m above local ground |
| Maximum nominal speed | 2.4 m/s before grip, slope, and roughness adjustments |
| Maximum yaw rate | 1.25 rad/s |
| Planner clearance | 1.0 m rover radius plus 0.24 m tracking margin |

Motion is kinematic. Speed decreases with pitch, roll, roughness, and lower grip.
Pose comes from height samples around the chassis. This is a product demonstration,
not a validated dynamics model: it does not simulate mass, torque, tire forces,
soil deformation, rollover dynamics, perception, SLAM, or a real motor controller.
Obstacle avoidance uses known geometry. If a checkpoint is obstructed and no
clear path exists, the rover waits for the operator to clear it.

The real camera/backend configuration and the regular frontend on port 5173 remain
separate. Demo mode cannot enable the automatic session in production builds.

## Files and API

| File | Purpose |
| --- | --- |
| `environments.py` | Presets, validated custom settings, height field, seeded scene generation |
| `engine.py` | Terrain-aware motion, mission lifecycle, telemetry, environment selection |
| `navigation.py` | Visibility graph planner with vehicle and boundary clearance |
| `camera.py` | Pose-based 640 × 360 software camera with terrain and weather |
| `server.py` | FastAPI, shared simulation state, WebSockets, authenticated commands and MJPEG |
| `static/world.js` | Terrain mesh, rover, wheel contact, views, rain, and routes |
| `static/terrain.js` | Browser height function, checked against the Python implementation |
| `static/app.js` | Environment editor, setup files, telemetry and mission controls |
| `tests/` | Engine, environment, camera, and live API rehearsal checks |

- `GET /simulation/environments`: preset catalog and remembered custom settings.
- `POST /simulation/environment`: `{ "environment_id": "mountain|rocky|forest|custom", "config": { ... } }`.
  `config` is optional and used for custom terrain. Unknown fields and out-of-range
  settings are rejected before state changes.
- `GET /simulation/state`, `WS /ws/simulation`: active environment, revision, pose,
  elevation, pitch, roll, grip, route, obstacle, and event history.
- `POST /simulation/commands`: `demo`, `start`, `pause`, `reset`, `obstacle`, `clear_obstacle`, `estop`.
- `GET /simulation/camera.jpg`: latest simulated camera frame.
- `/api/v1/cameras/primary`, `/api/v1/cameras/primary/stream`, `/ws/v1/telemetry`,
  `/api/v1/logs`: existing operator dashboard integration.

The public local-demo token is `navigen-local-simulation`. The launcher binds to
127.0.0.1. This service never connects to real motors, ROS, or the production database.

## Verification

```bash
simulation/.venv/bin/python -m unittest discover -s simulation/tests -v
# With the local servers running; this resets the selected patrol:
simulation/.venv/bin/python simulation/tests/smoke_demo.py
```

Unit checks cover every preset, custom extremes, repeated seeds, invalid settings,
terrain-dependent speed, matching browser/backend heights, camera output, switching,
obstacle avoidance, pause, and emergency stop. The live rehearsal checks authentication,
MJPEG delivery, a complete guided route, and reset. Allow up to three minutes.
