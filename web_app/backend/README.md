# NAVIGEN Backend

Production-oriented FastAPI boundary for the NAVIGEN operator application. The backend validates
Supabase users and trusted database roles, serves versioned REST and WebSocket APIs, persists
application history, and bridges approved commands and telemetry to a UGV. It is not part of the
robot's safety-critical control loop.

Canonical design documents:

- [Architecture](../docs/ARCHITECTURE.md)
- [Database schema](../docs/DATABASE_SCHEMA.md)

## Architecture

The dependency direction is `routes -> services -> repositories -> Supabase`. Routes parse and
authorize requests, services own lifecycle/safety rules, repositories contain persistence only,
and `ugv_integration` isolates rosbridge/ROS message details. Live telemetry travels directly from
the bridge to bounded WebSocket queues; selected history is downsampled into Supabase.

Supabase is accessed over its Auth and PostgREST APIs with `httpx`. User access tokens are checked
by Supabase Auth, while roles are always loaded from `user_roles` through the trusted service-role
client. The service-role key is never returned or sent to the frontend.

## Installation and local development

Python 3.11 or newer is required.

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

OpenAPI is available at `http://localhost:8000/docs`; the schema is at `/openapi.json`.

## Configuration

Required for a production deployment:

| Variable | Purpose |
|---|---|
| `APP_NAME` | OpenAPI/service display name |
| `APP_ENV` | `development`, `test`, or `production` |
| `DEBUG` | FastAPI/process debug behavior |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_PUBLISHABLE_KEY` | Key used only to validate Supabase Auth tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted backend PostgREST key; never expose to clients |
| `API_V1_PREFIX` | Defaults to `/api/v1` |
| `FRONTEND_ORIGINS` | Comma-separated explicit CORS origins; wildcard is rejected |
| `UGV_BRIDGE_URL` | rosbridge WebSocket URL |
| `UGV_CONNECTION_TIMEOUT_SECONDS` | Bridge connection/send timeout |
| `TELEMETRY_STALE_THRESHOLD_MS` | Server-authoritative freshness threshold |
| `TELEMETRY_PERSISTENCE_ENABLED` | Enable selected telemetry persistence |
| `TELEMETRY_PERSISTENCE_RATE_HZ` | Per-stream downsample rate, 1–5 Hz recommended |

Integration options:

| Variable | Purpose |
|---|---|
| `UGV_ROBOT_ID` | Registered `robots.id`; enables automatic bridge ingestion |
| `UGV_LOCALIZATION_TOPIC` | TrackingState topic; optional until the UGV contract finalizes it |
| `WEBSOCKET_QUEUE_SIZE` | Per-client outbound queue bound |
| `WEBSOCKET_MAX_DROPPED_MESSAGES` | Disconnect threshold for persistently slow clients |
| `WEBSOCKET_AUTH_TIMEOUT_SECONDS` | Time allowed for the first authentication message |

The application refuses missing Supabase values when `APP_ENV=production`. `.env.example` contains
placeholders only.

## REST API

All endpoints except `/health` and `/api/v1/status` require `Authorization: Bearer <access_token>`.

| Method | Path | Minimum role | Purpose |
|---|---|---|---|
| `GET` | `/health` | public | Lightweight liveness check |
| `GET` | `/api/v1/status` | public | Database/bridge connectivity summary |
| `GET` | `/api/v1/robots` | viewer | Paginated robots |
| `GET` | `/api/v1/robots/{robot_id}` | viewer | Robot detail |
| `GET` | `/api/v1/robots/{robot_id}/telemetry` | viewer | Bounded telemetry history |
| `GET` | `/api/v1/robots/{robot_id}/safety` | viewer | Bounded safety-event history |
| `GET` | `/api/v1/robots/{robot_id}/sensors` | viewer | Latest sensor statuses |
| `GET` | `/api/v1/robots/{robot_id}/localization` | viewer | Latest localization state |
| `GET` | `/api/v1/missions` | viewer | Paginated/filterable missions |
| `POST` | `/api/v1/missions` | operator | Create a mission and optional goals |
| `GET` | `/api/v1/missions/{mission_id}` | viewer | Mission with ordered goals |
| `PATCH` | `/api/v1/missions/{mission_id}` | operator | Validated lifecycle/update |
| `GET` | `/api/v1/missions/{mission_id}/goals` | viewer | Ordered goals |
| `POST` | `/api/v1/missions/{mission_id}/goals` | operator | Add a validated PoseStamped goal |
| `POST` | `/api/v1/robots/{robot_id}/commands` | operator | Persist, validate, and dispatch command |
| `GET` | `/api/v1/commands/{command_id}` | viewer | Command lifecycle record |
| `GET` | `/api/v1/logs` | viewer | Bounded application/integration logs |
| `PUT` | `/api/v1/admin/users/{user_id}/role` | admin | Manage trusted user role |

Telemetry accepts `from`, `to`, and `limit`; limits are capped server-side. API JSON uses canonical
`snake_case`. Frontend adapters are responsible for `camelCase` conversion.

### Command safety and idempotency

`set_goal` is dispatched only after the user role, robot, connection, payload, telemetry freshness,
safety state, and optional mission have passed validation. A failed precondition persists a
`rejected` command with a machine-readable `rejection_reason`; it is never sent to the UGV.
`software_estop` accepts only `{ "active": true }` and is never presented as a physical e-stop
release.

Clients may send an `Idempotency-Key` header (8–128 characters). The backend derives a stable UUID
from user, robot, and key. Exact retries return the original command; reusing a key for different
content returns `IDEMPOTENCY_CONFLICT`. This works across backend instances without a new database
column.

## WebSocket telemetry

Endpoint: `ws://localhost:8000/ws/v1/telemetry` (use `wss://` in production).

The first client message, required within the configured timeout, is:

```json
{"type":"authenticate","access_token":"<Supabase access token>"}
```

After the `authenticated` response, subscribe to selected robots (an empty list means all):

```json
{"type":"subscribe","robot_ids":["00000000-0000-0000-0000-000000000000"]}
```

Event envelopes contain `schema_version`, `event_type`, `robot_id`, `recorded_at`, `received_at`,
and `payload`. Supported event types are `robot.telemetry`, `robot.connection`, `motor.telemetry`,
`safety.changed`, `localization.changed`, `sensor.status`, `mission.created`, `mission.updated`,
`command.updated`, and `system.alert`. Per-client bounded queues ensure a slow browser cannot block
UGV ingestion; persistently slow or broken clients are removed.

## Supabase and UGV setup

The existing database must match the canonical schema; this backend deliberately does not recreate
it. Enable and review RLS/grants independently for every Data API table. Backend writes use only the
service role from trusted infrastructure.

Set `UGV_ROBOT_ID` only to an existing robot row. The rosbridge implementation subscribes to
`/motor/telemetry`, `/safety/state`, and `/odometry/filtered`, maps messages in
`app/ugv_integration/mappers.py`, and publishes `/goal_pose` and `/safety/e_stop`. The current UGV
repository still needs a tested `/goal_pose` to Nav2 `/navigate_to_pose` adapter before real goal
dispatch can be considered operational. Do not enable command dispatch on a physical robot until
that adapter and the safety supervisor have been field-tested.

## Quality checks

```bash
ruff check .
mypy app
pytest
```

Tests use in-memory Supabase and UGV fakes; no service-role key or physical robot is required.

## Security notes

- Terminate TLS before the API and use `https://`/`wss://` in production.
- WebSocket tokens are sent in the first frame, not in a URL query string.
- Never log JWTs, authorization headers, keys, or database credentials.
- Keep the service-role key only in the backend secret store.
- The backend does not issue low-level motor commands, clear a physical e-stop, disable RLS, or
  make itself safety-authoritative.
