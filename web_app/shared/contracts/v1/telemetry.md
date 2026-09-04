# Telemetry contract v1

WebSocket envelopes carry `schema_version`, `event_type`, `robot_id`, `recorded_at`, `received_at`, and `payload`.

Endpoint: `/ws/v1/telemetry`.

The first message authenticates with a Supabase access token:

```json
{"type":"authenticate","access_token":"<token>"}
```

After authentication, `{ "type": "subscribe", "robot_ids": [...] }` filters delivery. An empty
list subscribes to all robots. Tokens are deliberately sent in the first frame rather than URL
query parameters.

The backend calculates `data_age_ms` and `is_stale`; clients must not substitute their own safety
threshold. Live delivery uses bounded per-client queues. Historical persistence is independently
downsampled.
