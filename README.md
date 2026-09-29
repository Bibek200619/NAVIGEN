# NAVIGEN

**Camera-assisted ground vehicle today; GPS-denied autonomy as a research goal.** NAVIGEN brings a Raspberry Pi camera feed, rear obstacle distance, motion-sensor readings, and operator controls into a browser. The repository also contains a separate local 3D demonstration and a ROS 2/Gazebo navigation track. The physical vehicle has **not** demonstrated autonomous A-to-B driving.

The project addresses a practical gap in outdoor UGV development: an operator needs a view of the vehicle and trustworthy stop behavior before navigation algorithms can be tested on a real chassis. A single rear range sensor and an IMU cannot locate the vehicle or detect hazards ahead. NAVIGEN therefore presents the current vehicle as a **manual, camera-assisted prototype** and keeps simulation results distinct from field results. The repository identifies Smart India Hackathon problem statement SIH26126 as its original challenge context.

> **Physical-build gate (30 September 2026):** Motor output is locked in the checked-in ESP8266 firmware. A 3S pack was measured at **12.6 V** at the L298N, while the four TT motors are rated **3–6 V**; two motors share each driver channel. The 127/255 PWM duty limit does not lower the voltage of each pulse or prove that the driver can handle stall current. Keep the physical motor-power switch **off** until the supply, driver, and wiring have been corrected and measured. See [motor commissioning](navigen_ugv/firmware/esp8266_motor_controller/README.md#motor-power-and-active-lockout).

## What is available

| Track | Status | Verified in this repository | Boundary |
|---|---|---|---|
| **Physical Pi dashboard** | Implemented, propulsion gated | Token-protected HTTP interface, Pi Camera JPEG feed, rear HC-SR04 distance, MPU-6500-compatible IMU display, buzzer configuration, hold-to-drive commands, software e-stop, USB serial reconnection and ESP8266 watchdog. A mock mode runs without hardware. | The current firmware configuration inhibits motor output. There is no wheel encoder, forward range sensing, or position estimate. |
| **Local 3D demo** | Implemented simulation | FastAPI/Three.js terrain simulation with preset and generated environments, guided patrol, simulated camera and telemetry, obstacle detour, and a React operator dashboard. | Its planner uses known simulated geometry. It is not a physical perception, SLAM, or dynamics result. |
| **ROS 2 research** | In development | Jazzy packages for a vehicle description, serial hardware bridge, Gazebo Harmonic world, and known-map Nav2 simulation. | ROS is not required by the deployed Pi dashboard; autonomous physical navigation remains unvalidated. |
| **Web application** | In development | React/TypeScript operator pages and a FastAPI REST/WebSocket backend with Supabase Auth/PostgREST and rosbridge adapters. The backend has tests using service fakes. | No database migration is committed, and the complete web-to-physical-UGV pipeline is not established. |
| **Mobile application** | Planned | A planning README. | No mobile implementation is present. |

**Domain:** outdoor robotics and UGV operation; supporting domains are embedded/IoT control, computer vision, simulation, and operator software. Camera capture is implemented; learned vision inference on the physical vehicle is future work.

## Try NAVIGEN

The **local demo** is the quickest reproducible experience. It needs Python 3.11+, Node.js/npm, uv, Git, and internet access for the first dependency install. The launcher installs from committed lockfiles and binds both services to 127.0.0.1.

~~~bash
git clone https://github.com/Bibek200619/NAVIGEN.git
cd NAVIGEN/web_app
./simulation/start.sh
~~~

Open [the 3D view](http://127.0.0.1:8010) and select **Run guided demo**; [the operator dashboard](http://127.0.0.1:5174) shows the same simulated run. Choose an environment, observe the patrol and obstacle detour, then stop both processes with Ctrl+C. This path needs no Pi, database, ROS installation, or credentials. The simulation's local demo token is intentionally public and must never be used as a production secret. [Demo controls and model assumptions](web_app/simulation/README.md).

For a **hardware-free test of the Pi interface**, from the repository root:

~~~bash
uv run --with numpy --with opencv-python --with pyserial python navigen_ugv/pi_controller/app.py --mock
~~~

Open http://127.0.0.1:8080, enter the token printed in the terminal, and select **Connect**. Mock mode labels its synthetic camera and does not open the motor serial port. The real Pi installation, Ubuntu camera build, systemd service, and lifted-wheel commissioning steps are in the [Pi runtime guide](navigen_ugv/pi_controller/README.md) and [operations guide](navigen_ugv/pi_controller/OPERATIONS.md). The previously configured Pi dashboard is reachable on its local network at http://Hexcore.local:8080; that address is a team setup, not a public deployment.

## How the current vehicle works

The browser requests frames and status from a small HTTP server on the Pi. The Pi reads the CSI camera and I²C motion module, exchanges CRC-protected commands and telemetry with the ESP8266 over USB, and rejects commands when its camera or controller data are stale. The ESP8266 owns the rear range sensor, buzzer, motor pins, command-loss watchdog, and firmware configuration lockout. The physical switch cuts motor power independently of the browser. A valid rear measurement can block reverse and pivot motion; the operator must still watch for forward obstacles.

~~~mermaid
flowchart LR
    OP[Operator] -->|token, hold-to-drive| UI[Pi browser dashboard]
    CAM[Pi Camera 1] --> PI[Raspberry Pi 5 HTTP controller]
    IMU[MPU-compatible I2C sensor] --> PI
    UI <-->|status, camera JPEG, commands| PI
    PI <-->|CRC USB serial| ESP[NodeMCU ESP8266]
    US[Rear HC-SR04] --> ESP
    ESP --> BUZ[Buzzer, default off]
    ESP -->|locked pending commissioning| DRV[L298N]
    SW[Physical motor switch] --> DRV
    DRV --> MOT[Four TT motors]
~~~

This is the **overall operational workflow** for the physical prototype. The current motor lockout is a real output gate, not a diagram-only warning.

### Architecture across tracks

~~~mermaid
flowchart TB
    subgraph Deployed[Physical prototype]
      PUI[Pi static dashboard] --> PAPI[Pi HTTP controller]
      PAPI --> SERIAL[USB serial and ESP8266 firmware]
      PCAM[Pi Camera and IMU] --> PAPI
    end
    subgraph Local[Independent local demo]
      REACT[React operator UI] --> SIM[FastAPI simulation API]
      VIEW[Three.js 3D view] --> SIM
      SIM --> ENGINE[Terrain, kinematic rover and known-geometry planner]
    end
    subgraph Research[Separate integration and research]
      WEB[React application] --> API[FastAPI operator backend]
      API -->|designed integration| SB[Supabase Auth and PostgREST]
      API -->|rosbridge adapter| ROS[ROS 2 and Gazebo packages]
    end
~~~

The Pi dashboard, local demo, and general web backend are different run modes. The backend routes through services and repositories; its configured UGV_ROBOT_ID enables a rosbridge ingestion task. The [database schema](web_app/docs/DATABASE_SCHEMA.md) is a **contract**, not proof of a deployed database: web_app/backend/app/db/migrations contains no SQL migration. The [web architecture document](web_app/docs/ARCHITECTURE.md) describes the intended integration boundary.

### Data flow and stop path

~~~mermaid
flowchart LR
    SRC[Camera, IMU and rear echo] --> CHECK[Pi and ESP freshness/validity checks]
    CHECK --> STATUS[Authenticated status and camera responses]
    STATUS --> RENDER[Browser cards and live view]
    INPUT[Operator press or release] --> AUTH[Bearer-token check and input validation]
    AUTH --> LEASE[Pi motion lease and software e-stop]
    LEASE --> SERIAL[CRC serial command]
    SERIAL --> GUARD[ESP watchdog, rear guard and configuration gate]
    GUARD --> OUTPUT[Motor GPIO or zero output]
    SWITCH[Physical switch] --> OUTPUT
~~~

The physical path has no database write or AI inference. A missing/stale rear reading is treated conservatively for reverse. The browser's **Release e-stop** action concerns the software latch; it cannot override the physical motor switch or firmware lockout.

### Operator journey

~~~mermaid
flowchart TD
    START[Open Pi dashboard] --> TOKEN[Enter Pi session token]
    TOKEN --> HEALTH[Check fresh camera, rear distance and controller status]
    HEALTH -->|unhealthy or lockout| STOP[Keep stopped; inspect fault]
    HEALTH -->|commissioned hardware only| RELEASE[Release software e-stop]
    RELEASE --> HOLD[Hold W/A/S/D or a drive control]
    HOLD --> WATCH[Watch camera and surroundings]
    WATCH -->|release, timeout or Space| STOP
~~~

### Deployment boundary

~~~mermaid
flowchart LR
    LAPTOP[Laptop browser on local Wi-Fi] -->|local HTTP or SSH tunnel| PI[Raspberry Pi 5: Pi HTTP service]
    PI -->|CSI and I2C| SENS[Camera and motion sensor]
    PI -->|USB| MCU[ESP8266 firmware]
    MCU -->|GPIO| HW[Rear sensor, buzzer and L298N]
    DEV[Developer workstation] -->|localhost 5174| DEMOUI[React demo]
    DEV -->|localhost 8010| DEMOAPI[FastAPI and Three.js demo]
~~~

No CDN, hosted web service, production database, or cloud deployment is configured by this repository. The Pi service can be enabled with the supplied [systemd template](navigen_ugv/pi_controller/navigen-dashboard@.service). Remote network access would need TLS, access control, and an explicit deployment design.

## Components and technology

| Layer | Technology in source | Responsibility |
|---|---|---|
| Physical controller | Python HTTP server, Picamera2, OpenCV, pyserial, smbus2 | Camera/status API, authenticated operator commands, serial and IMU readers |
| Embedded controller | C++ / PlatformIO, NodeMCU ESP8266 | Sensor sampling, watchdog, rear guard, buzzer and motor GPIO lockout |
| General web UI | React 19, TypeScript, Vite, Tailwind CSS | Robot, camera, mission, sensor, log and settings pages |
| Web API | FastAPI, Pydantic, httpx, WebSocket | Routes, command checks, telemetry delivery, camera relay, Supabase/rosbridge adapters |
| Local demo | FastAPI, Three.js, Pillow | Procedural terrain, simulated rover/camera, guided route |
| Robotics research | ROS 2 Jazzy, Gazebo Harmonic, Nav2 | Vehicle model, known-map simulation, hardware bridge |
| Data design | Supabase Postgres schema document | Planned persistent robots, missions, telemetry, commands and logs; migration pending |
| Verification | pytest, unittest, Vitest, TypeScript, ESLint, GitHub Actions | Component and integration tests; current CI covers web_app/frontend only |

### Repository map

~~~text
NAVIGEN/
├── README.md
├── .github/                   # Frontend CI and issue templates
├── navigen_ugv/
│   ├── pi_controller/         # Deployed Pi dashboard and tests
│   ├── firmware/esp8266_motor_controller/
│   ├── ros2_ws/src/          # ROS packages, launch, robot description and Nav2
│   ├── docs/                 # Hardware, architecture and test notes
│   └── scripts/              # Core and firmware validation
├── web_app/
│   ├── frontend/             # React operator application
│   ├── backend/              # FastAPI, adapters and tests
│   ├── simulation/           # Independent 3D local demo
│   ├── shared/               # Versioned application contracts
│   └── docs/                 # Web architecture and database contract
└── mobile_app/               # Planning document only
~~~

The camera build and ESP8266 pin map live in the component guides. navigen_ugv/PROJECT_PROGRESS.md records earlier research phases; its historical percentages are not a measure of the current physical vehicle.

## Development paths

Use the component you intend to work on; the paths do not need to run together.

| Path | Start and verify | Requirements |
|---|---|---|
| **Pi mock** | Run the uv command above; inspect camera/status and e-stop in the browser. | Python and uv; no real motor output. |
| **Local demo** | cd web_app and run ./simulation/start.sh; open ports 8010 and 5174. | Python 3.11+, Node/npm, uv; installs locked dependencies. |
| **React app** | cd web_app/frontend; run npm ci, npm run dev, npm test, npm run lint, npm run build. | Node.js 22 is used by CI. Live data needs a configured API or the demo launcher. |
| **FastAPI backend** | cd web_app/backend; create/activate a Python venv, run pip install -e '.[dev]', copy .env.example to .env, then uvicorn app.main:app --reload; run pytest. | Python 3.11+. Real protected routes need a configured Supabase project and schema. Do not commit .env. |
| **ROS simulation** | Follow the [Jazzy/Gazebo setup](navigen_ugv/README.md#4-ubuntu-setup-for-the-ros-research-track), then launch navigen_bringup or the known-map Nav2 simulation. | Ubuntu 24.04, ROS 2 Jazzy, Gazebo Harmonic and listed ROS dependencies. |

For the application workspace, these are the commands represented by the table:

~~~bash
cd web_app/frontend
npm ci
npm run dev
~~~

In another terminal from the repository root:

~~~bash
cd web_app/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload
~~~

The backend requires valid external-service settings and an installed schema for authenticated data workflows; its public /health endpoint can be checked without those services. Run each directory's tests as listed above. The application workspace is separate from the local demo launcher.

The backend example keys in [web_app/backend/.env.example](web_app/backend/.env.example) are placeholders. Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY, FRONTEND_ORIGINS, and UGV_BRIDGE_URL for a real integration; set CAMERA_STREAM_URL for the backend camera relay. The service-role key belongs on the backend only. Frontend endpoint overrides are in [web_app/frontend/.env.example](web_app/frontend/.env.example). The backend has no reproducible database bootstrap yet, so its protected workflows cannot be demonstrated solely by following the install commands.

## Interfaces and data

The **Pi API** uses one process-local or owner-readable-file bearer token:

| Method | Path | Purpose |
|---|---|---|
| GET | /api/status | Controller, rear distance, camera and IMU state |
| GET | /api/camera.jpg | Latest camera JPEG |
| POST | /api/command | Bounded manual velocity request |
| POST | /api/estop | Engage or request release of software e-stop |
| POST | /api/buzzer | Enable/disable buzzer and set distance threshold |

The **web backend** exposes GET /health, GET /api/v1/status, robot/telemetry/safety/sensor/localization reads, mission and goal routes, POST /api/v1/robots/{robot_id}/commands, command/log reads, an admin role route, a camera relay, and WS /ws/v1/telemetry. Its [backend guide](web_app/backend/README.md#rest-api) lists exact paths and roles. Supabase Auth validates access tokens; the backend loads roles from user_roles. The source includes bounded WebSocket queues and command precondition checks. Full operation still depends on a deployed schema, rosbridge, and an end-to-end-tested UGV goal adapter.

The **proposed database** groups robots, missions/mission_goals, telemetry and sensor status, commands, system_logs, and user roles around a robot ID. This is specified in the [schema contract](web_app/docs/DATABASE_SCHEMA.md); there is no migration to install it and no evidence here of production data. Database costs, retention, RLS policy, and backups must be decided before deploying it.

## Engineering assessment

| Constraint | Why it matters | Current approach | Next validation |
|---|---|---|---|
| Motor power and driver current | The measured 12.6 V rail exceeds the motors' 6 V rating, and paired stall currents may approach a driver channel limit. | Physical switch off; firmware arming flag and voltage record block output. | Fit a measured suitable motor rail and driver with thermal/current margin; conduct lifted-wheel and stop tests. |
| Rear-only sensing | Forward obstacles cannot be measured by the HC-SR04. | Human camera supervision; conservative reverse guard. | Add and validate forward sensing and stopping-distance tests before autonomy. |
| No wheel odometry | Commands, PWM and IMU tilt cannot establish distance or global pose. | Display only measured quantities; ROS navigation stays a separate simulation track. | Add an independently validated localization source and record field error. |
| Camera and USB freshness | Stale frames or lost serial control can hide hazards or leave a command active. | Pi freshness checks, motion lease, latched stop and ESP watchdog. | Measure end-to-end latency and fault behavior outdoors. |
| Web/database integration | Routes and UI exist, but the schema and physical command path are not reproducibly deployed. | Repository contracts, adapter code and fake-backed tests. | Commit migrations/RLS; test Auth, rosbridge and goal handoff against the real robot. |

**Feasibility:** The manual camera/status workflow uses available parts and runs locally, while propulsion depends on electrical redesign. The local simulation is inexpensive to reproduce on a developer machine, but it is a presentation model. A deployable multiuser service needs a real Supabase project, schema migrations, TLS termination, secret storage, backups, and operations ownership; no verified cost estimate is available. Scaling the web backend would require shared event delivery and measured database retention/query plans, since its current WebSocket manager is process-local. Expanding to more vehicles or regions would also require connection isolation, authorization scopes, and network-failure testing. These changes do not make the physical control loop safe by themselves.

**Security and privacy:** The Pi checks a bearer token before camera/status/command APIs and uses an owner-only token file when configured. The backend has token validation, trusted role lookup, command checks and restricted CORS configuration. The repository does **not** include production TLS, a deployed RLS policy, or a verified secret-management/backup setup. Camera frames and operator activity should be treated as access-controlled data. The local demo token is deliberately public; do not expose its server beyond loopback or reuse it for a real robot.

**Limitations:** No tested physical autonomy, SLAM, AI model, forward collision protection, wheel speed/distance, cloud service, database migration, or mobile app is available. The ROS known-map simulation and 3D demo are evidence of software behavior in their respective environments, not field performance. The Pi dashboard permits software e-stop release only when its own checks pass, and the ESP firmware lockout remains the final motor-output gate until commissioning.

## Roadmap and collaboration

1. **Commission the manual prototype:** correct motor power and driver, verify wiring, record electrical/thermal and lifted-wheel stop tests, then perform controlled ground trials.
2. **Make integration reproducible:** commit reviewed Supabase migrations/RLS and end-to-end tests for frontend, backend, rosbridge and the vehicle command adapter.
3. **Develop localization and perception:** add measured forward obstacle sensing and a validated pose source before testing autonomous navigation outside simulation.
4. **Harden operations:** define deployment, HTTPS/WSS, access scopes, observability, retention, backups and multi-vehicle behavior from measured demand.

The differentiator is the explicit separation between a working operator/sensor loop, a reproducible visual demo, and a research autonomy stack. That separation lets collaborators evaluate each claim against its evidence and keeps unverified simulated success from being mistaken for an outdoor field result. A safe, affordable, remotely inspectable UGV could support future inspection or learning workflows, but impact and savings have not been quantified.

Contributions should start with a focused GitHub issue, then a branch such as feature/camera-health or docs/wiring, relevant tests, and a pull request linked to the issue. Use a descriptive commit prefix (feat:, fix:, docs:, test:, chore:). Review hardware-impacting changes with a bench plan before applying them to the vehicle.

~~~mermaid
flowchart LR
    IDEA[Issue and acceptance criteria] --> BRANCH[Focused branch]
    BRANCH --> CHANGE[Implementation or documentation]
    CHANGE --> TEST[Relevant tests and evidence]
    TEST --> PR[Pull request and review]
    PR --> MERGE[Merge to main]
~~~

There is currently no repository license file; contributors should agree on licensing before external reuse. Existing issue templates live in [.github/ISSUE_TEMPLATE/](.github/ISSUE_TEMPLATE/). The repository's CI currently validates only frontend changes.

## Demo and further reading

**Screenshot placeholder:** no verified product screenshots are committed. Capture the local demo, the Pi camera/dashboard, and the physical build after a reviewed demo run; do not substitute rendered simulation frames for field photos. For a live review, run the local demo or Pi mock above; [simulation guidance](web_app/simulation/README.md) describes the presentation sequence. Useful source documents are the [physical operations guide](navigen_ugv/pi_controller/OPERATIONS.md), [ESP8266 firmware and pin map](navigen_ugv/firmware/esp8266_motor_controller/README.md), [ROS research setup](navigen_ugv/README.md), and [web backend/API guide](web_app/backend/README.md).

**Contributor credited in the previous project README:** Nikhil Chhetri — AI/full-stack/DevOps development, Gazebo simulation, backend integration and testing.
