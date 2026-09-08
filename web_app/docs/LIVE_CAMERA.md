# Live camera

The operator UI uses a light, minimal workspace with one primary camera viewport. The
same viewer is available in Overview and Live camera. It supports pause/resume,
JPEG snapshots, full screen, manual retry, frame dimensions, and observed frame rate.
Unavailable video is hidden, so a disconnected camera cannot appear to be live.

## Connect the vehicle

1. Provide an HTTP(S) MJPEG stream reachable **from the backend host**. The repository's
   camera topic is `/camera/image_raw`. If using ROS 2 `web_video_server`, an example is:

   ```dotenv
   CAMERA_STREAM_URL=http://<vehicle-host>:8080/stream?topic=/camera/image_raw&type=mjpeg
   ```

   See [web_video_server](https://github.com/RobotWebTools/web_video_server) for installation
   and ROS streaming options. Start it on the vehicle or another host that can subscribe
   to the camera topic. This application does not install or launch ROS camera drivers.
   Native RTSP and raw USB devices require an MJPEG gateway; they cannot be used directly.

2. Add the URL to `backend/.env`, along with the existing authentication configuration.
   Restart the backend. An empty URL deliberately leaves the camera unconfigured.

   ```bash
   cd backend
   .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
   ```

3. Start the frontend:

   ```bash
   cd frontend
   npm run dev
   ```

   Vite proxies `/api` and `/ws` to `127.0.0.1:8000`. In a hosted installation, configure
   an equivalent reverse proxy, or set `VITE_API_URL` to the backend origin and include
   the frontend origin in `FRONTEND_ORIGINS`. `VITE_WS_URL` optionally overrides the
   derived `/ws/v1/telemetry` address. Use HTTPS/WSS when the frontend uses HTTPS.
   Disable proxy buffering for the camera route and allow long-lived responses.

4. Open **Connection**, enter a valid **user access token** from the existing authentication
   service, and choose **Connect session**. Never enter a service-role key. The app checks
   the token using the existing backend authentication boundary before connecting video
   and telemetry. Tokens are kept only in memory, sent in authorization headers (or the
   telemetry authentication message), and cleared on reload or Disconnect. Expired tokens
   require reconnection with a renewed token. An integrated sign-in/refresh UI is outside
   this change.

5. Open **Live camera**. “Live” appears only after a JPEG has decoded successfully.
   Pause stops this browser's upstream subscription. It does not turn off the physical camera.
   Snapshot downloads the current displayed frame locally; no video is stored in Postgres.

## Backend contract

Both routes require the existing `require_authenticated` dependency; viewer, operator,
and admin roles follow the application's existing read-access policy.

| Route | Response |
| --- | --- |
| `GET /api/v1/cameras/primary` | `{ "camera_id": "primary", "name": "Front camera", "configured": true, "transport": "mjpeg" }` |
| `GET /api/v1/cameras/primary/stream` | `multipart/x-mixed-replace; boundary=frame` containing JPEG frames |

`configured` describes configuration only. It is not a camera health claim. This is one
operator-configured primary source per backend instance, rather than a per-robot camera registry.
The upstream URL is never returned, accepted from the browser, or redirected to.

- Empty source: `503 CAMERA_NOT_CONFIGURED`.
- Viewer slots exhausted: `503 CAMERA_BUSY`.
- Upstream error, timeout, redirect, or unsupported content type before streaming:
  `502 CAMERA_UNAVAILABLE` with a sanitized message.
- Stream errors after headers close the response; the UI hides the last frame and offers Retry.
- Defaults: 4 simultaneous upstream subscriptions per backend process, 8-second upstream
  network timeout, 4 MiB maximum JPEG. Browser decoding also enforces a 4 MiB limit and
  a 12-second no-frame watchdog. Keep the backend frame limit at or below 4 MiB for this client.
- Responses use `Cache-Control: no-store` and disable reverse-proxy buffering.
- Each viewer owns one upstream connection, released on disconnect. No frame history is retained.

The frontend telemetry connection now uses the canonical authentication handshake and
`/ws/v1/telemetry`, and is shared across page subscribers. Sensor activity comes from
`sensor.status` events instead of hard-coded active labels. Gateway connection and camera
connection are separate; neither is used as proof that the vehicle is safe to move.
Mission dispatch remains unavailable and no command is sent by the refreshed mission view.

## Verification

```bash
cd frontend
npm run build
npm run lint
cd ../backend
.venv/bin/pytest -q
.venv/bin/ruff check app tests/integration/test_camera.py
.venv/bin/mypy app
```

Camera tests cover authorization, missing configuration, fragmented JPEGs, sanitized
upstream errors, redirects, frame limits, viewer limits, cancellation, and cleanup.
Browser verification used a temporary local MJPEG fixture with alternating JPEG frames,
including authenticated access, pause/resume, snapshot, full screen, source failure/retry,
route navigation, and mobile layout. This fixture is not part of the application.
A physical vehicle stream still needs to be verified after its host/source is supplied.
