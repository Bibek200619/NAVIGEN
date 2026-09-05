#!/usr/bin/env bash
set -euo pipefail
SIMULATION_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SIMULATION_DIR")"
cd "$PROJECT_DIR"
command -v uv >/dev/null || { echo 'Install uv first: https://docs.astral.sh/uv/getting-started/installation/'; exit 1; }
command -v npm >/dev/null || { echo 'Install Node.js and npm first.'; exit 1; }
python3 - <<'PY'
import socket
for port in (8010, 5174):
    with socket.socket() as sock:
        if sock.connect_ex(('127.0.0.1', port)) == 0:
            raise SystemExit(f'Port {port} is already in use. Stop the previous demo before launching again.')
PY
if [ ! -d simulation/node_modules/three ]; then npm ci --prefix simulation; fi
if [ ! -d frontend/node_modules ]; then npm ci --prefix frontend; fi
uv sync --project simulation --locked
SIM_PID=''
UI_PID=''
cleanup() {
  trap - EXIT INT TERM
  if [ -n "$UI_PID" ]; then kill "$UI_PID" 2>/dev/null || true; fi
  if [ -n "$SIM_PID" ]; then kill "$SIM_PID" 2>/dev/null || true; fi
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM
simulation/.venv/bin/python -m uvicorn server:app --app-dir simulation --host 127.0.0.1 --port 8010 > simulation/server.log 2>&1 &
SIM_PID=$!
VITE_SIMULATION_MODE=true VITE_API_URL=http://127.0.0.1:8010 VITE_WS_URL=ws://127.0.0.1:8010/ws/v1/telemetry node frontend/node_modules/vite/bin/vite.js frontend --host 127.0.0.1 --port 5174 --strictPort > simulation/dashboard.log 2>&1 &
UI_PID=$!
python3 - <<'PY'
import time, urllib.request
for url in ('http://127.0.0.1:8010/health', 'http://127.0.0.1:5174'):
    for attempt in range(100):
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200: break
        except (OSError, ValueError): time.sleep(.2)
    else: raise SystemExit('Demo startup failed. Check simulation/server.log and simulation/dashboard.log.')
PY
echo ''
echo 'NAVIGEN SIMULATION IS READY'
echo '  3D demo:    http://127.0.0.1:8010'
echo '  Dashboard:  http://127.0.0.1:5174'
echo '  Click Run guided demo for the presentation.'
echo '  Press Ctrl+C here to stop both demo servers.'
wait "$SIM_PID" "$UI_PID"
