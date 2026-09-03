# NAVIGEN Supabase Database Schema

> **Status:** Canonical v1 database naming contract  
> **Database:** Supabase Postgres  
> **Companion document:** [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## 1. Purpose

This document is the single source of truth for NAVIGEN database names, columns, relationships, enum values, and frontend mappings.

The goal is to prevent backend, frontend, mobile, and UGV code from creating duplicate concepts under different names.

Do not introduce a new table, column, enum value, or renamed field without updating this contract in the same pull request.

## 2. Naming Rules

### Database

Use `snake_case` for:

- table names;
- column names;
- enum values;
- SQL functions;
- indexes;
- constraints.

Examples:

```text
robot_id
mission_id
battery_level_pct
created_at
updated_at
```

### Primary keys

Every application table uses:

```text
id uuid primary key
```

Recommended default:

```sql
gen_random_uuid()
```

Exceptions are only allowed when a table intentionally uses a natural/composite key and the change is documented.

### Foreign keys

Foreign keys use the singular referenced entity name plus `_id`:

```text
robot_id
mission_id
user_id
requested_by
```

### Timestamps

Use Postgres `timestamptz`.

Canonical names:

```text
created_at
updated_at
recorded_at
received_at
started_at
completed_at
acknowledged_at
executed_at
```

Do not store Unix milliseconds as the canonical persisted timestamp when `timestamptz` is appropriate.

### Boolean columns

Use positive readable names:

```text
is_active
is_stale
estop_active
watchdog_triggered
configuration_valid
serial_connected
```

Avoid ambiguous flags like `status_bool`, `flag`, or `enabled_status`.

## 3. Canonical Enums

Postgres enums or CHECK constraints may be used. The values below are canonical regardless of implementation method.

### `user_role`

```text
admin
operator
viewer
```

### `robot_status`

```text
idle
navigating
manual
offline
error
```

### `connection_status`

```text
connected
disconnected
connecting
```

### `mission_status`

```text
pending
in_progress
completed
failed
aborted
```

### `command_status`

```text
pending
accepted
rejected
executed
failed
```

### `command_type`

Initial v1 values:

```text
set_goal
software_estop
```

Add new values only when the backend and UGV command contract supports them.

### `safety_state`

```text
ok
warning
emergency_stop
```

ROS mapping:

```text
0 -> ok
1 -> warning
2 -> emergency_stop
```

### `localization_state`

```text
initializing
tracking
lost
relocalizing
```

ROS mapping:

```text
0 -> initializing
1 -> tracking
2 -> lost
3 -> relocalizing
```

### `log_level`

```text
debug
info
warning
error
critical
```

## 4. Entity Relationship Overview

```text
auth.users
    |
    +---- profiles
    |
    +---- user_roles
    |
    +---- missions.created_by
    |
    +---- commands.requested_by

robots
  |
  +---- missions
  |       |
  |       +---- mission_goals
  |       +---- commands
  |
  +---- robot_telemetry
  +---- motor_telemetry
  +---- safety_events
  +---- localization_status
  +---- sensor_status
  +---- commands
  +---- system_logs
```

## 5. Table: `profiles`

One application profile per Supabase Auth user.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | — | PK and FK -> `auth.users.id` |
| `display_name` | `text` | yes | — | Human-facing name |
| `avatar_url` | `text` | yes | — | Optional profile image |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

### Frontend mapping

```text
id            -> id
display_name  -> displayName
avatar_url    -> avatarUrl
created_at    -> createdAt
updated_at    -> updatedAt
```

## 6. Table: `user_roles`

Trusted authorization state. Do not use user-editable profile metadata for access-control decisions.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `user_id` | `uuid` | no | — | FK -> `auth.users.id` |
| `role` | `user_role` | no | `viewer` | Canonical role |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

### Constraints

```text
UNIQUE(user_id)
```

### Frontend mapping

```text
user_id     -> userId
role        -> role
created_at  -> createdAt
updated_at  -> updatedAt
```

## 7. Table: `robots`

One row per NAVIGEN UGV registered with the application.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `name` | `text` | no | — | Human-readable robot name |
| `slug` | `text` | no | — | Stable unique identifier for URLs/config |
| `status` | `robot_status` | no | `offline` | Current application-level state |
| `connection_status` | `connection_status` | no | `disconnected` | Current integration connection |
| `last_seen_at` | `timestamptz` | yes | — | Last valid UGV telemetry received |
| `description` | `text` | yes | — | Optional operator description |
| `metadata` | `jsonb` | no | `'{}'::jsonb` | Non-contract extension metadata only |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

### Constraints

```text
UNIQUE(slug)
```

### Frontend mapping

```text
connection_status -> connectionStatus
last_seen_at      -> lastSeenAt
created_at        -> createdAt
updated_at        -> updatedAt
```

## 8. Table: `missions`

Mission lifecycle owned by one robot.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `robot_id` | `uuid` | no | — | FK -> `robots.id` |
| `name` | `text` | no | — | Mission name |
| `description` | `text` | yes | — | Optional details |
| `status` | `mission_status` | no | `pending` | Lifecycle state |
| `created_by` | `uuid` | no | — | FK -> `auth.users.id` |
| `started_at` | `timestamptz` | yes | — | |
| `completed_at` | `timestamptz` | yes | — | |
| `failure_reason` | `text` | yes | — | Used for failed/aborted outcomes |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

### Existing frontend compatibility

The frontend currently expects:

```ts
interface Mission {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'aborted';
  createdAt?: string;
  updatedAt?: string;
}
```

Canonical adapter mapping:

```text
robot_id       -> robotId
created_by     -> createdBy
started_at     -> startedAt
completed_at   -> completedAt
failure_reason -> failureReason
created_at     -> createdAt
updated_at     -> updatedAt
```

## 9. Table: `mission_goals`

A mission can contain one or more ordered target poses.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `mission_id` | `uuid` | no | — | FK -> `missions.id` |
| `sequence_no` | `integer` | no | — | Goal order beginning at 0 or 1; choose once in backend and keep consistent |
| `frame_id` | `text` | no | `map` | ROS pose frame |
| `position_x` | `double precision` | no | — | metres |
| `position_y` | `double precision` | no | — | metres |
| `position_z` | `double precision` | no | `0` | metres |
| `orientation_x` | `double precision` | no | `0` | quaternion |
| `orientation_y` | `double precision` | no | `0` | quaternion |
| `orientation_z` | `double precision` | no | — | quaternion |
| `orientation_w` | `double precision` | no | — | quaternion |
| `reached_at` | `timestamptz` | yes | — | Set when goal reached |
| `created_at` | `timestamptz` | no | `now()` | |

### Constraints

```text
UNIQUE(mission_id, sequence_no)
```

### ROS mapping

Maps to the approved `geometry_msgs/PoseStamped` goal contract.

```text
frame_id
position_x/y/z
orientation_x/y/z/w
```

## 10. Table: `robot_telemetry`

Downsampled application-level telemetry for dashboards/history.

This table is intentionally different from raw `motor_telemetry`.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `robot_id` | `uuid` | no | — | FK -> `robots.id` |
| `recorded_at` | `timestamptz` | no | — | UGV/source timestamp |
| `received_at` | `timestamptz` | no | `now()` | Backend receive time |
| `connection_status` | `connection_status` | no | — | |
| `is_stale` | `boolean` | no | `false` | Calculated at ingestion/snapshot time |
| `data_age_ms` | `integer` | no | `0` | Freshness at snapshot time |
| `position_x` | `double precision` | yes | — | Fused/local map pose |
| `position_y` | `double precision` | yes | — | |
| `position_z` | `double precision` | yes | — | |
| `yaw` | `double precision` | yes | — | radians |
| `linear_velocity` | `double precision` | yes | — | m/s |
| `angular_velocity` | `double precision` | yes | — | rad/s |
| `battery_level_pct` | `double precision` | yes | — | 0–100 application estimate |
| `safety_state` | `safety_state` | yes | — | Current safety summary |
| `localization_state` | `localization_state` | yes | — | Current localization summary |
| `created_at` | `timestamptz` | no | `now()` | DB insertion time |

### Frontend mapping

```text
robot_id            -> robotId
recorded_at         -> recordedAt
received_at         -> receivedAt
connection_status   -> connectionStatus
is_stale            -> isStale
data_age_ms          -> dataAgeMs
position_x           -> pose.x
position_y           -> pose.y
position_z           -> pose.z
yaw                  -> pose.yaw
linear_velocity      -> linearVelocity
angular_velocity     -> angularVelocity
battery_level_pct    -> batteryLevelPct
safety_state         -> safetyState
localization_state   -> localizationState
```

### Existing frontend migration note

The current frontend mock uses:

```text
batteryLevel
```

The canonical v1 frontend name should become:

```text
batteryLevelPct
```

because the stored value is a percentage and must not be confused with battery voltage.

## 11. Table: `motor_telemetry`

Selected/downsampled low-level telemetry from `navigen_interfaces/MotorTelemetry`.

Canonical ROS field names are deliberately preserved.

| Column | Type | Null | Notes |
|---|---|:---:|---|
| `id` | `uuid` | no | PK |
| `robot_id` | `uuid` | no | FK -> `robots.id` |
| `recorded_at` | `timestamptz` | no | ROS/header source time |
| `received_at` | `timestamptz` | no | Backend receive time |
| `left_velocity` | `real` | no | m/s |
| `right_velocity` | `real` | no | m/s |
| `left_setpoint` | `real` | no | m/s |
| `right_setpoint` | `real` | no | m/s |
| `left_pwm` | `smallint` | no | Applied PWM |
| `right_pwm` | `smallint` | no | Applied PWM |
| `left_ticks` | `bigint` | no | Cumulative encoder ticks |
| `right_ticks` | `bigint` | no | Cumulative encoder ticks |
| `battery_voltage` | `real` | no | volts |
| `ultrasonic_left` | `real` | no | metres; ROS uses `-1.0` when invalid |
| `ultrasonic_right` | `real` | no | metres; ROS uses `-1.0` when invalid |
| `estop_active` | `boolean` | no | Hardware e-stop input state |
| `watchdog_triggered` | `boolean` | no | Firmware command watchdog |
| `configuration_valid` | `boolean` | no | Firmware required configuration valid |
| `serial_connected` | `boolean` | no | Raspberry Pi bridge transport state |
| `acknowledged_command_sequence` | `integer` | no | ROS uint16 mapped to integer |
| `command_age` | `real` | no | seconds |
| `rx_crc_errors` | `bigint` | no | Cumulative CRC rejects |
| `created_at` | `timestamptz` | no | DB insert time |

### Important ingestion rule

Do not persist all source-rate samples (20–50 Hz) by default. Downsample at the backend according to configured retention requirements and preserve full-rate engineering sessions through ROS bag/local logs.

## 12. Table: `safety_events`

Stores safety state transitions and noteworthy safety events.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `robot_id` | `uuid` | no | — | FK -> `robots.id` |
| `recorded_at` | `timestamptz` | no | — | UGV source timestamp |
| `received_at` | `timestamptz` | no | `now()` | |
| `state` | `safety_state` | no | — | Canonical readable state |
| `active_triggers` | `text[]` | no | `'{}'` | Direct mapping from ROS `SafetyState` |
| `description` | `text` | yes | — | ROS/operator-readable detail |
| `created_at` | `timestamptz` | no | `now()` | |

### ROS mapping

`navigen_interfaces/SafetyState`:

```text
state
active_triggers
description
```

Persist every state transition. Duplicate periodic samples are not required unless needed for field-test analysis.

## 13. Table: `localization_status`

Stores visual localization/tracking health.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `robot_id` | `uuid` | no | — | FK -> `robots.id` |
| `recorded_at` | `timestamptz` | no | — | Source timestamp |
| `received_at` | `timestamptz` | no | `now()` | |
| `state` | `localization_state` | no | — | Canonical tracking state |
| `tracked_features` | `integer` | no | `0` | ROS `uint32` mapped safely |
| `created_at` | `timestamptz` | no | `now()` | |

### ROS mapping

From `TrackingState.msg`:

```text
state
tracked_features
```

## 14. Table: `sensor_status`

Latest application-facing sensor health. Prefer one row per robot + sensor key and UPSERT it.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `robot_id` | `uuid` | no | — | FK -> `robots.id` |
| `sensor_key` | `text` | no | — | Stable programmatic name |
| `name` | `text` | no | — | Human display name |
| `topic` | `text` | yes | — | ROS topic if applicable |
| `is_active` | `boolean` | no | `false` | Current health/activity |
| `frequency_hz` | `double precision` | yes | — | Observed rate |
| `last_updated_at` | `timestamptz` | yes | — | Last valid data time |
| `details` | `jsonb` | no | `'{}'::jsonb` | Sensor-specific non-contract detail |
| `updated_at` | `timestamptz` | no | `now()` | |

### Constraints

```text
UNIQUE(robot_id, sensor_key)
```

### Existing frontend mapping

Current frontend type:

```ts
interface SensorStatusInfo {
  name: string;
  topic: string;
  isActive: boolean;
  frequency?: number;
  lastUpdated?: number;
}
```

Canonical mapping:

```text
sensor_key      -> sensorKey
is_active       -> isActive
frequency_hz    -> frequencyHz
last_updated_at -> lastUpdatedAt
```

Prefer `frequencyHz` and ISO timestamp `lastUpdatedAt` over unitless `frequency` and Unix `lastUpdated` in the final frontend contract.

## 15. Table: `commands`

Audit record and lifecycle for backend-approved operator commands.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `robot_id` | `uuid` | no | — | FK -> `robots.id` |
| `mission_id` | `uuid` | yes | — | FK -> `missions.id` when applicable |
| `requested_by` | `uuid` | no | — | FK -> `auth.users.id` |
| `command_type` | `command_type` | no | — | `set_goal`, `software_estop`, ... |
| `status` | `command_status` | no | `pending` | Lifecycle |
| `request_payload` | `jsonb` | no | `'{}'::jsonb` | Validated command body |
| `response_payload` | `jsonb` | no | `'{}'::jsonb` | UGV/backend acknowledgement metadata |
| `rejection_reason` | `text` | yes | — | Why rejected |
| `failure_reason` | `text` | yes | — | Why accepted command later failed |
| `requested_at` | `timestamptz` | no | `now()` | |
| `acknowledged_at` | `timestamptz` | yes | — | Accepted/rejected acknowledgement |
| `executed_at` | `timestamptz` | yes | — | Completed execution where meaningful |
| `created_at` | `timestamptz` | no | `now()` | |
| `updated_at` | `timestamptz` | no | `now()` | |

### Important rule

Frontend clients do not directly insert command rows. The backend validates a request first and creates/updates this lifecycle record.

### Command payload: `set_goal`

Recommended `request_payload` shape:

```json
{
  "frame_id": "map",
  "position": {
    "x": 4.2,
    "y": 1.5,
    "z": 0.0
  },
  "orientation": {
    "x": 0.0,
    "y": 0.0,
    "z": 0.0,
    "w": 1.0
  }
}
```

### Command payload: `software_estop`

```json
{
  "active": true
}
```

The application must not define a remote command that releases the physical e-stop.

## 16. Table: `system_logs`

Application/integration logs suitable for operator history and debugging. This is not a replacement for full ROS logs/bags.

| Column | Type | Null | Default | Notes |
|---|---|:---:|---|---|
| `id` | `uuid` | no | `gen_random_uuid()` | PK |
| `robot_id` | `uuid` | yes | — | FK -> `robots.id` when robot-related |
| `mission_id` | `uuid` | yes | — | FK -> `missions.id` when mission-related |
| `level` | `log_level` | no | `info` | |
| `source` | `text` | no | — | e.g. `backend`, `ugv_bridge`, `mission_service` |
| `event_code` | `text` | yes | — | Stable machine-readable code |
| `message` | `text` | no | — | Human-readable message |
| `context` | `jsonb` | no | `'{}'::jsonb` | Structured details |
| `recorded_at` | `timestamptz` | no | `now()` | Event time |
| `created_at` | `timestamptz` | no | `now()` | DB insertion time |

## 17. Recommended Indexes

Initial indexes:

```text
profiles(id)
user_roles(user_id UNIQUE)
robots(slug UNIQUE)
robots(connection_status)
missions(robot_id, created_at DESC)
missions(status, created_at DESC)
mission_goals(mission_id, sequence_no UNIQUE)
robot_telemetry(robot_id, recorded_at DESC)
motor_telemetry(robot_id, recorded_at DESC)
safety_events(robot_id, recorded_at DESC)
localization_status(robot_id, recorded_at DESC)
sensor_status(robot_id, sensor_key UNIQUE)
commands(robot_id, requested_at DESC)
commands(mission_id, requested_at DESC)
commands(status, requested_at DESC)
system_logs(robot_id, recorded_at DESC)
system_logs(level, recorded_at DESC)
```

Do not add indexes blindly. Validate query patterns as the backend develops.

## 18. Retention Guidance

Initial recommendation only; tune after real field data exists.

| Table | Suggested initial retention |
|---|---|
| `robots` | permanent |
| `profiles` / `user_roles` | while user exists + audit policy |
| `missions` / `mission_goals` | permanent or project lifetime |
| `commands` | permanent/audit |
| `safety_events` | permanent/audit |
| `system_logs` | 30–90 days unless tied to important test runs |
| `robot_telemetry` | 7–30 days raw snapshots, aggregate later |
| `motor_telemetry` | short retention unless field-test evidence requires longer |
| `localization_status` | 7–30 days or mission-linked retention |
| `sensor_status` | latest state; historical changes can be logged separately |

Do not implement deletion jobs until the team approves actual field-test retention requirements.

## 19. RLS and Data API Contract

Every table in an exposed schema must have an explicit security decision.

Recommended v1 approach:

### Browser-readable tables

Potentially readable by authenticated users under role-aware policies:

```text
profiles
robots
missions
mission_goals
robot_telemetry
safety_events
localization_status
sensor_status
commands
system_logs
```

Whether the frontend actually reads these directly or exclusively through the backend is an implementation choice, but policies must be safe either way if the table is exposed.

### Backend-only writes

Use trusted backend infrastructure for writes to:

```text
robots
missions
mission_goals
robot_telemetry
motor_telemetry
safety_events
localization_status
sensor_status
commands
system_logs
user_roles
```

### Security requirements

- Enable RLS on exposed tables.
- Explicitly grant only required table privileges to `anon` / `authenticated` when Data API access is intended.
- RLS does not replace SQL grants; both layers matter.
- `authenticated` by itself is not authorization; policies must check ownership or trusted roles where needed.
- Never expose the Supabase service-role/secret key to the React or mobile application.
- Role decisions should come from trusted database/app metadata, not user-editable metadata.

## 20. Recommended Foreign-Key Delete Behavior

| Relationship | Recommended delete behavior |
|---|---|
| `profiles.id -> auth.users.id` | cascade |
| `user_roles.user_id -> auth.users.id` | cascade |
| `missions.robot_id -> robots.id` | restrict |
| `missions.created_by -> auth.users.id` | restrict or preserve via audit strategy |
| `mission_goals.mission_id -> missions.id` | cascade |
| telemetry -> `robots.id` | cascade only if robot deletion is an explicit destructive admin operation; otherwise restrict/archive robots |
| `commands.robot_id -> robots.id` | restrict |
| `commands.mission_id -> missions.id` | set null or restrict according to audit policy |
| `commands.requested_by -> auth.users.id` | preserve audit via restrict or separate immutable actor fields |

For audit-heavy tables, prefer preserving records instead of casually cascading user/robot deletion.

## 21. Updated-at Trigger

Tables with `updated_at` should use one shared trigger/function rather than requiring every application call to remember the timestamp.

Target tables:

```text
profiles
user_roles
robots
missions
commands
sensor_status
```

Create the implementation through a reviewed Supabase migration once the schema is approved.

## 22. Frontend Naming Dictionary

This dictionary is mandatory for shared fields.

| Database/API | Frontend TypeScript |
|---|---|
| `robot_id` | `robotId` |
| `mission_id` | `missionId` |
| `user_id` | `userId` |
| `requested_by` | `requestedBy` |
| `created_by` | `createdBy` |
| `connection_status` | `connectionStatus` |
| `battery_level_pct` | `batteryLevelPct` |
| `battery_voltage` | `batteryVoltage` |
| `linear_velocity` | `linearVelocity` |
| `angular_velocity` | `angularVelocity` |
| `left_velocity` | `leftVelocity` |
| `right_velocity` | `rightVelocity` |
| `left_setpoint` | `leftSetpoint` |
| `right_setpoint` | `rightSetpoint` |
| `left_pwm` | `leftPwm` |
| `right_pwm` | `rightPwm` |
| `left_ticks` | `leftTicks` |
| `right_ticks` | `rightTicks` |
| `estop_active` | `estopActive` |
| `watchdog_triggered` | `watchdogTriggered` |
| `configuration_valid` | `configurationValid` |
| `serial_connected` | `serialConnected` |
| `acknowledged_command_sequence` | `acknowledgedCommandSequence` |
| `command_age` | `commandAge` |
| `rx_crc_errors` | `rxCrcErrors` |
| `active_triggers` | `activeTriggers` |
| `tracked_features` | `trackedFeatures` |
| `sensor_key` | `sensorKey` |
| `is_active` | `isActive` |
| `frequency_hz` | `frequencyHz` |
| `last_updated_at` | `lastUpdatedAt` |
| `recorded_at` | `recordedAt` |
| `received_at` | `receivedAt` |
| `created_at` | `createdAt` |
| `updated_at` | `updatedAt` |
| `started_at` | `startedAt` |
| `completed_at` | `completedAt` |
| `acknowledged_at` | `acknowledgedAt` |
| `executed_at` | `executedAt` |
| `is_stale` | `isStale` |
| `data_age_ms` | `dataAgeMs` |
| `failure_reason` | `failureReason` |
| `rejection_reason` | `rejectionReason` |
| `request_payload` | `requestPayload` |
| `response_payload` | `responsePayload` |

## 23. Do Not Create These Duplicate Names

Examples of aliases that should **not** coexist:

```text
robots + vehicles
missions + jobs
mission_goals + targets
robot_id + bot_id + vehicle_id
battery_level_pct + battery_percent + battery_percentage
battery_voltage + voltage
connection_status + connection_state
recorded_at + timestamp + event_time
estop_active + emergency_stop_active + e_stop
localization_state + tracking_status
sensor_key + sensor_id_string
```

If a new concept genuinely differs semantically, document the difference before adding a second name.

## 24. Schema Versioning

Initial contract:

```text
schema_version = 1
```

The database does not need a `schema_version` column on every row. Versioning belongs primarily to migrations and external application payloads.

For WebSocket/API payloads, include `schema_version` when the shape is contract-sensitive.

Breaking changes require coordinated migration and consumer updates.

## 25. Initial Migration Order

When the team is ready to create the database, the recommended implementation sequence is:

```text
1. enums / check constraints
2. profiles
3. user_roles
4. robots
5. missions
6. mission_goals
7. commands
8. robot_telemetry
9. motor_telemetry
10. safety_events
11. localization_status
12. sensor_status
13. system_logs
14. indexes
15. updated_at triggers
16. grants
17. RLS policies
18. seed one development robot
19. verification queries
20. database advisors/security review
```

Do not create the production schema manually table-by-table in the dashboard without also preserving a reproducible migration in source control.

## 26. Verification Checklist

Before declaring the Supabase schema ready:

- [ ] all canonical tables exist once and only once;
- [ ] all columns match this document;
- [ ] foreign keys are valid;
- [ ] enum/check values match exactly;
- [ ] duplicate synonyms have not been introduced;
- [ ] required indexes exist;
- [ ] timestamp columns use `timestamptz`;
- [ ] RLS is enabled for every exposed table;
- [ ] grants match intended Data API access;
- [ ] anonymous access is explicitly tested;
- [ ] authenticated viewer/operator/admin access is explicitly tested;
- [ ] browser/mobile cannot obtain a service-role secret;
- [ ] backend can insert telemetry and command lifecycle rows;
- [ ] frontend adapters convert canonical names correctly;
- [ ] ROS `MotorTelemetry` maps without accidental renaming;
- [ ] ROS `SafetyState` numeric state maps to canonical string values;
- [ ] ROS `TrackingState` numeric state maps to canonical string values;
- [ ] mission status matches the existing frontend contract;
- [ ] representative WebSocket/API payloads pass frontend type validation;
- [ ] database security/advisor checks have been reviewed.

## 27. Future Extensions

Do not add these until their UGV/app contracts are finalized:

```text
perception_events
traversability_snapshots
navigation_events
map_sessions
media_assets
notifications
mission_runs / field_test_runs
```

They are expected future concepts, not approved v1 tables yet.
