# NAVIGEN Web App

Operator dashboard and application integration layer for the NAVIGEN UGV. The Web application is an operator tool and is **not part of the UGV autonomy or safety control loop**.

## Current structure

```text
web_app/
├── frontend/        # React + TypeScript + Vite operator dashboard
├── backend/         # FastAPI-ready API/integration service
│   ├── app/
│   │   ├── api/v1/
│   │   ├── core/
│   │   ├── db/
│   │   ├── models/
│   │   ├── repositories/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── websocket/
│   │   └── ugv_integration/
│   └── tests/
├── shared/          # Versioned cross-team contracts and examples
│   ├── contracts/v1/
│   └── examples/v1/
└── docs/
    ├── ARCHITECTURE.md
    └── DATABASE_SCHEMA.md
```

The previous root-level `webapp/` project has been consolidated into `web_app/frontend/`. `web_app/` is the single canonical root for all Web work.

## Frontend

The current frontend provides the application shell and UI areas for dashboard, camera, robot state, sensors, missions, logs, settings, and telemetry/API abstractions.

Run it with:

```bash
cd web_app/frontend
npm install
npm run dev
```

## Backend

The backend scaffold is organized around clear boundaries for API routes, validation schemas, business services, database repositories, live WebSocket delivery, and UGV/ROS integration.

After installing the backend package, the intended development entry point is:

```bash
cd web_app/backend
uvicorn app.main:app --reload
```

`/health` and `/api/v1/status` are the initial system endpoints. Business endpoints remain intentionally unimplemented until their Supabase schema and authorization behavior are wired against the approved contract.

## Shared contracts

`shared/contracts/v1/` is implementation-neutral and belongs to all application teams. It defines canonical enum values and the telemetry, mission, and command contracts. `shared/examples/v1/` contains representative payloads that frontend/backend/mobile tests can consume.

## Architecture and database contracts

Before adding a database field, API name, WebSocket event, or ROS-to-app mapping, read:

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/DATABASE_SCHEMA.md`](docs/DATABASE_SCHEMA.md)

Database/API-facing names use `snake_case`; frontend models may use `camelCase` through explicit adapters.
