# NAVIGEN Backend

FastAPI-ready backend scaffold for the NAVIGEN Web application.

## Responsibilities

- authenticated REST API under `/api/v1`;
- backend WebSocket delivery for live UGV telemetry;
- Supabase persistence through repository/service boundaries;
- ROS/UGV bridge integration;
- command validation and lifecycle handling;
- telemetry freshness/downsampling;
- audit/system logging.

The canonical architecture and database contracts live in `../docs/`.
