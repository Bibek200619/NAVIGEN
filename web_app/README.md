# NAVIGEN Web App

Operator dashboard and application integration layer for the NAVIGEN UGV. The Web application is an operator tool and is **not part of the UGV autonomy or safety control loop**.

## Current structure

```text
web_app/
├── frontend/        # React + TypeScript + Vite operator dashboard
├── backend/         # Backend/API service (to be implemented)
├── shared/          # Shared contracts/examples (to be implemented)
└── docs/
    ├── ARCHITECTURE.md
    └── DATABASE_SCHEMA.md
```

The previous root-level `webapp/` project has been consolidated into `web_app/frontend/`. `web_app/` is now the single canonical root for all Web work.

## Frontend

The current frontend provides the application shell and UI areas for:

- dashboard;
- camera;
- robot state;
- sensors;
- missions;
- logs;
- settings;
- telemetry/API abstractions.

Run it with:

```bash
cd web_app/frontend
npm install
npm run dev
```

## Architecture and database contracts

Before adding backend models, API fields, database columns, or new frontend domain names, follow:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — system boundaries, naming, API/WebSocket rules, UGV integration, and safety contract.
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md) — canonical Supabase table names, columns, enums, relationships, and frontend mappings.

## UGV integration contract

The UGV exposes telemetry to the application integration layer, including the canonical ROS-side sources such as:

```text
/motor/telemetry
/safety/state
/odometry/filtered
```

Approved command direction:

```text
/goal_pose       geometry_msgs/PoseStamped
/safety/e_stop   std_msgs/Bool
```

All Web mission and safety-sensitive requests must pass through the backend validation layer. The Web application must never bypass the UGV safety supervisor or release the physical e-stop.
