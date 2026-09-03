# NAVIGEN Web Application Architecture

> **Status:** Canonical v1 architecture contract  
> **Scope:** `web_app`, backend/API, Supabase persistence, Web frontend, and NAVIGEN UGV integration  
> **Audience:** Backend, frontend, mobile, UGV, integration, and database contributors

## 1. Purpose

This document is the architectural source of truth for the NAVIGEN operator web application and its integration with the NAVIGEN UGV.

Its main goal is to stop backend, frontend, mobile, UGV, and database code from inventing different names or data shapes for the same concept.

The companion database contract is [`DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md). If this document and implementation code disagree, the team must update the documentation and shared contract in the same pull request that changes the implementation.

## 2. Core System Boundary

NAVIGEN Web is an **operator application**. It is not part of the UGV autonomy or safety control loop.

```text
                         NAVIGEN UGV
                       Raspberry Pi 5
                              |
                         ROS 2 Jazzy
                              |
              +---------------+----------------+
              |                                |
       read-only telemetry              approved commands
              |                                |
              v                                ^
      UGV integration bridge / transport layer
              |                                ^
              v                                |
                    Backend / API
              +-----------+-----------+
              |           |           |
              v           v           v
         Supabase      WebSocket    Command
         Postgres      live feed    validation
              |           |           |
              +-----------+-----------+
                          |
                          v
                    React frontend
```

### Safety rule

The Web application may:

- observe UGV state;
- submit mission goals through the approved backend command path;
- request a **software e-stop**;
- display command acceptance, rejection, and result state.

The Web application must never:

- directly drive motors;
- bypass the ROS safety supervisor;
- clear or release a physical e-stop;
- keep autonomy running when the UGV declares an unsafe state;
- treat Supabase, the browser, or the backend as safety-authoritative.

The UGV safety supervisor and hardware watchdog remain authoritative.

## 3. Architecture Decisions

### ADR-001 — Canonical database naming is `snake_case`

Supabase/Postgres table names, column names, enum values, SQL functions, and database-facing payload fields use `snake_case`.

Examples:

```text
battery_level_pct
connection_status
linear_velocity
created_at
robot_id
mission_id
```

### ADR-002 — Frontend TypeScript may use `camelCase`, but only through adapters

Frontend domain models may use normal TypeScript `camelCase`:

```text
battery_level_pct  <-> batteryLevelPct
connection_status  <-> connectionStatus
linear_velocity    <-> linearVelocity
created_at         <-> createdAt
robot_id           <-> robotId
mission_id         <-> missionId
```

Frontend code must not create ad-hoc alternate names. Database/API rows are converted at the service/adapter boundary.

### ADR-003 — ROS-native field names are preserved where practical

When a Supabase column represents a field from a NAVIGEN custom ROS message, use the ROS field name unless there is a strong reason not to.

Examples from `MotorTelemetry.msg` remain:

```text
left_velocity
right_velocity
left_setpoint
right_setpoint
left_pwm
right_pwm
left_ticks
right_ticks
battery_voltage
ultrasonic_left
ultrasonic_right
estop_active
watchdog_triggered
configuration_valid
serial_connected
acknowledged_command_sequence
command_age
rx_crc_errors
```

This reduces transformation bugs between the Raspberry Pi, backend, and database.

### ADR-004 — Backend is the command boundary

The frontend must not publish ROS commands directly and must not write command rows directly as a substitute for command validation.

All mission and safety-sensitive requests go through the backend:

```text
Frontend -> authenticated API -> validation -> command record -> UGV bridge -> ROS
```

The backend verifies:

- authenticated user;
- authorization/role;
- target robot;
- robot connection/freshness;
- current safety state;
- command schema;
- command lifecycle and idempotency where applicable.

### ADR-005 — Live telemetry and historical telemetry are different workloads

ROS telemetry can arrive much faster than a dashboard database should be written.

Use two paths:

1. **Live path:** UGV -> backend -> WebSocket -> Web/Mobile.
2. **Persistence path:** backend validates, downsamples/aggregates, and stores selected telemetry in Supabase.

Do not insert every 20–50 Hz motor telemetry message into Supabase by default. Full-rate engineering data should remain available through ROS bags/local field-test logging. Supabase is the application/history store.

Recommended initial persistence rates:

| Data | Live rate | Supabase strategy |
|---|---:|---|
| Motor telemetry | source rate, typically 20–50 Hz | downsample to configurable 1–5 Hz plus important transitions |
| Robot pose/velocity | live dashboard rate | configurable 1–5 Hz |
| Safety state | immediate | store every transition/event |
| Localization state | live | store transitions and periodic health samples |
| Sensor status | live/periodic | upsert latest status per sensor |
| Mission lifecycle | event driven | store every state change |
| Commands | event driven | store complete lifecycle |
| Camera/video | realtime stream | never store frame blobs in Postgres |

### ADR-006 — Camera/video does not belong in Postgres

Live video should use a streaming transport appropriate for the camera pipeline.

If recordings or snapshots are required later:

- store files in object storage;
- store only metadata, ownership, timestamps, checksums, and object paths/URLs in Postgres.

### ADR-007 — Version contracts explicitly

Application-facing contracts start at **v1**.

Recommended API path:

```text
/api/v1/...
```

Telemetry envelopes should carry:

```text
schema_version: 1
```

A breaking field removal, semantic change, or incompatible type change requires a new contract version. Adding an optional field does not necessarily require a new major version.

## 4. Target Repository Structure

The canonical web application location is `web_app/`.

```text
web_app/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── types/
│   │   ├── adapters/
│   │   └── hooks/
│   └── ...
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── websocket/
│   │   └── ugv_integration/
│   └── tests/
├── shared/
│   ├── contracts/
│   └── examples/
└── docs/
    ├── ARCHITECTURE.md
    └── DATABASE_SCHEMA.md
```

### Current frontend branch note

The working frontend currently exists under `webapp/` on the frontend branch. When frontend work is integrated into the monorepo, the team should converge on:

```text
web_app/frontend/
```

Do not keep both `webapp/` and `web_app/` as permanent roots; that would create two competing application locations.

## 5. Technology Responsibilities

### Frontend

Current intended stack:

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router

Responsibilities:

- UI rendering;
- authenticated session handling;
- calling backend REST endpoints;
- consuming backend WebSocket telemetry;
- converting database/API `snake_case` payloads into frontend `camelCase` models through adapters;
- client-side display validation;
- offline/stale-state presentation;
- never making safety-critical authorization decisions by itself.

### Backend

Recommended role: FastAPI or equivalent typed Python API service.

Responsibilities:

- authentication token verification;
- authorization;
- REST API;
- WebSocket client delivery;
- ROS/UGV transport integration;
- validation and canonicalization;
- command acceptance/rejection;
- telemetry freshness calculation;
- persistence/downsampling;
- database transactions;
- audit logging.

### Supabase

Responsibilities:

- Postgres persistence;
- Supabase Auth;
- database constraints;
- indexes;
- RLS for any Data API exposed tables;
- optional Realtime for non-control application events if adopted later;
- optional Storage for future recordings/snapshots.

Supabase is **not** the UGV control loop.

### UGV integration

Responsibilities:

- subscribe to approved ROS telemetry topics;
- convert ROS messages into canonical v1 application payloads;
- publish only approved commands from the backend;
- preserve timestamps and freshness metadata;
- reconnect safely;
- never block ROS control loops on network/database operations.

## 6. Canonical ROS Integration

### Read from UGV

At minimum the application integration layer is expected to consume:

```text
/motor/telemetry
/safety/state
/odometry/filtered
```

Additional production signals can include:

```text
/battery
/imu/data
/visual_odom
/tracking/state              # adapter-specific name; confirm final topic
/traversability/...
/navigation/...              # confirm final production topic names
```

Do not rename ROS topics casually. If a topic name changes, update this document, the shared contract, UGV implementation, and integration tests together.

### Send to UGV

Approved direction:

```text
/goal_pose       geometry_msgs/PoseStamped
/safety/e_stop   std_msgs/Bool
```

The web application may request software e-stop assertion. Physical e-stop release remains a physical/operator UGV action.

## 7. Canonical Application Domain

The v1 application domain uses the following nouns exactly:

```text
profile
user_role
robot
mission
mission_goal
command
robot_telemetry
motor_telemetry
safety_event
localization_status
sensor_status
system_log
```

Plural table/resource forms are defined in `DATABASE_SCHEMA.md`.

Avoid synonyms such as:

```text
vehicle vs robot
job vs mission
waypoint_target vs mission_goal
panic vs emergency_stop
bot_id vs robot_id
userId vs owner_id for the same relationship
```

Choose the canonical noun and reuse it.

## 8. Status Enums

Use these values exactly in v1.

### Robot status

```text
idle
navigating
manual
offline
error
```

### Mission status

```text
pending
in_progress
completed
failed
aborted
```

### Connection status

```text
connected
disconnected
connecting
```

Staleness is represented separately from transport connection status.

### Safety state

ROS numeric values are translated to readable application values:

```text
0 -> ok
1 -> warning
2 -> emergency_stop
```

Canonical stored/API values:

```text
ok
warning
emergency_stop
```

### Localization/tracking state

ROS numeric values are translated to:

```text
0 -> initializing
1 -> tracking
2 -> lost
3 -> relocalizing
```

Canonical stored/API values:

```text
initializing
tracking
lost
relocalizing
```

### Command status

```text
pending
accepted
rejected
executed
failed
```

## 9. API Contract Rules

### URLs

Use plural resource names and kebab-free stable paths where possible:

```text
GET  /api/v1/robots
GET  /api/v1/robots/{robot_id}
GET  /api/v1/robots/{robot_id}/telemetry
GET  /api/v1/missions
POST /api/v1/missions
GET  /api/v1/missions/{mission_id}
POST /api/v1/missions/{mission_id}/goals
POST /api/v1/robots/{robot_id}/commands
GET  /api/v1/commands/{command_id}
```

### JSON casing

Backend API payloads use database-compatible `snake_case` in v1.

Frontend adapters convert these fields into frontend TypeScript `camelCase` where desired.

Example API payload:

```json
{
  "robot_id": "uuid",
  "recorded_at": "2026-09-03T08:10:00Z",
  "connection_status": "connected",
  "linear_velocity": 0.42,
  "angular_velocity": 0.03,
  "battery_level_pct": 81.5,
  "is_stale": false
}
```

Frontend model:

```ts
{
  robotId,
  recordedAt,
  connectionStatus,
  linearVelocity,
  angularVelocity,
  batteryLevelPct,
  isStale
}
```

## 10. Live Telemetry Envelope

WebSocket telemetry should use one stable envelope.

```json
{
  "schema_version": 1,
  "event_type": "robot.telemetry",
  "robot_id": "uuid",
  "recorded_at": "2026-09-03T08:10:00Z",
  "received_at": "2026-09-03T08:10:00.050Z",
  "payload": {}
}
```

Recommended event types:

```text
robot.telemetry
robot.connection
motor.telemetry
safety.changed
localization.changed
sensor.status
mission.created
mission.updated
command.updated
system.alert
```

Every live message that originates from UGV data should preserve source time where available and include backend receive time so freshness can be calculated.

## 11. Freshness and Stale Data

Connection and freshness are different concepts.

A socket may still be connected while robot data is stale.

Canonical fields:

```text
connection_status
recorded_at
received_at
data_age_ms
is_stale
```

Rules:

- backend calculates `data_age_ms`;
- backend sets `is_stale` using the configured threshold for that stream;
- frontend does not silently infer safety from a green socket icon;
- mission/command UI must be disabled when required telemetry is stale, disconnected, or unsafe.

Exact stale thresholds should be configuration, not duplicated magic numbers across frontend/backend.

## 12. Command Lifecycle

```text
requested
   |
   v
pending
   |
   +--> rejected
   |
   v
accepted
   |
   +--> failed
   |
   v
executed
```

Every command must have a persistent `commands.id` so frontend, backend, logs, and UGV acknowledgements can refer to the same request.

A command record captures:

- who requested it;
- target robot;
- optional mission;
- canonical command type;
- request payload;
- status;
- rejection/failure reason;
- request/acknowledgement/execution timestamps.

## 13. Authentication and Authorization

Recommended flow:

```text
Browser -> Supabase Auth -> access token
Browser -> Backend with Bearer token
Backend -> verify token and authorization
Backend -> database / UGV integration
```

Authorization roles for v1:

```text
admin
operator
viewer
```

Intended capabilities:

| Capability | admin | operator | viewer |
|---|:---:|:---:|:---:|
| View telemetry | yes | yes | yes |
| View missions/logs | yes | yes | yes |
| Create mission | yes | yes | no |
| Submit goal | yes | yes | no |
| Assert software e-stop | yes | yes | no |
| Manage roles | yes | no | no |

Do not base authorization on user-editable profile metadata. Authorization must be controlled by trusted server/database state.

## 14. Supabase Security Rules

For any table intentionally exposed through the Supabase Data API:

1. enable RLS;
2. explicitly decide which database roles receive `SELECT`, `INSERT`, `UPDATE`, or `DELETE` grants;
3. add row policies matching the actual ownership/role model;
4. test the policies as `anon` and `authenticated` roles;
5. do not expose server secrets or the service-role key to browser/mobile code.

Grants and RLS are separate controls: a role needs the required grant before its RLS policy can permit rows.

By default, robot telemetry ingestion and command persistence should occur from trusted backend infrastructure rather than unauthenticated browser writes.

## 15. Database Access Boundaries

Recommended v1 ownership:

| Data | Browser direct DB write? | Backend write? |
|---|:---:|:---:|
| `profiles` display fields | optional, policy-controlled | yes |
| `user_roles` | no | yes/admin-only |
| `robots` | no | yes |
| `missions` | no | yes |
| `mission_goals` | no | yes |
| `commands` | no | yes |
| telemetry tables | no | yes |
| `sensor_status` | no | yes |
| `system_logs` | no | yes |

This keeps the backend as the validation boundary even if Supabase also exposes a Data API.

## 16. Error Contract

REST errors should use a stable shape:

```json
{
  "error": {
    "code": "ROBOT_TELEMETRY_STALE",
    "message": "Robot telemetry is stale; command rejected.",
    "details": {},
    "request_id": "uuid"
  }
}
```

Error codes are machine-readable uppercase `SNAKE_CASE`. Human messages may change without breaking clients.

Recommended initial codes:

```text
UNAUTHENTICATED
FORBIDDEN
ROBOT_NOT_FOUND
ROBOT_OFFLINE
ROBOT_TELEMETRY_STALE
ROBOT_UNSAFE
MISSION_NOT_FOUND
MISSION_INVALID_STATE
COMMAND_INVALID
COMMAND_REJECTED
UGV_BRIDGE_UNAVAILABLE
DATABASE_ERROR
INTERNAL_ERROR
```

## 17. Shared Contract Workflow

Any PR that changes one of the following must update the shared contract and docs:

- database table/column name;
- enum value;
- API path;
- REST request/response field;
- WebSocket event type;
- ROS-to-app mapping;
- mission lifecycle;
- command lifecycle;
- safety semantics.

Recommended review requirement:

```text
Database/backend change -> backend + frontend reviewer
Frontend contract change -> frontend + backend reviewer
ROS mapping change -> UGV + backend reviewer
Safety command change -> UGV/safety + backend reviewer
```

## 18. Integration Testing Requirements

Before the v1 contract is considered complete, test at least:

- ROS mock telemetry -> backend -> WebSocket -> frontend;
- ROS mock telemetry -> backend -> Supabase;
- reconnect after UGV transport loss;
- stale-data detection;
- safety state transition propagation;
- mission creation and goal submission;
- accepted command lifecycle;
- rejected command lifecycle;
- software e-stop assertion;
- unauthorized command rejection;
- frontend adapters against representative v1 payloads.

## 19. Open Decisions for Later Phases

These should not block the initial schema:

- exact production camera streaming protocol;
- final traversability/perception payload after UGV Phase 7;
- final visual localization topic after UGV Phase 8;
- final navigation/planner health payload after later UGV phases;
- object-storage strategy for recorded camera media;
- long-term telemetry retention/partitioning policy;
- whether Supabase Realtime is needed in addition to backend WebSockets.

When these are finalized, extend v1 with optional fields/tables where compatible or create a new contract version where breaking.

## 20. Definition of Done for the v1 Architecture Contract

The architecture contract is adopted when:

- [ ] frontend is integrated under `web_app/frontend/`;
- [ ] backend is created under `web_app/backend/`;
- [ ] database schema follows `DATABASE_SCHEMA.md`;
- [ ] frontend adapters use the documented mappings;
- [ ] backend validates canonical enums and field names;
- [ ] WebSocket payloads carry `schema_version`;
- [ ] command requests go through the backend;
- [ ] RLS/grants are reviewed for every exposed Supabase table;
- [ ] mock end-to-end integration tests pass;
- [ ] Web, backend, UGV, and mobile contributors approve the shared contract.
