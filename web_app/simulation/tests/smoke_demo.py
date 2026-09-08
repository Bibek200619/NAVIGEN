"""Exercise a running local demo. Resets simulation state before and after the check."""

import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8010"
TOKEN = "navigen-local-simulation"


def request(path, action=None, authenticated=True, payload=None):
    headers = {"Authorization": f"Bearer {TOKEN}"} if authenticated else {}
    body = None
    if action is not None or payload is not None:
        headers["Content-Type"] = "application/json"
        body = json.dumps(
            payload if payload is not None else {"action": action}
        ).encode()
    with urllib.request.urlopen(
        urllib.request.Request(BASE + path, data=body, headers=headers), timeout=5
    ) as response:
        return json.load(response)


def command(action):
    return request("/simulation/commands", action)


for path, action in [
    ("/api/v1/cameras/primary", None),
    ("/simulation/commands", "start"),
]:
    try:
        request(path, action, authenticated=False)
        raise AssertionError("Unauthenticated access was accepted")
    except urllib.error.HTTPError as error:
        assert error.code == 401
print("Authentication boundaries: passed", flush=True)
assert request("/api/v1/cameras/primary")["simulation"] is True
stream_request = urllib.request.Request(
    BASE + "/api/v1/cameras/primary/stream",
    headers={"Authorization": f"Bearer {TOKEN}"},
)
with urllib.request.urlopen(stream_request, timeout=5) as response:
    first = response.read(4096)
    assert b"--frame" in first and b"\xff\xd8" in first
print("MJPEG delivery: passed", flush=True)
catalog = request("/simulation/environments")
assert {item["id"] for item in catalog["presets"]} == {"mountain", "rocky", "forest"}
for preset in ("rocky", "forest", "mountain"):
    selected = request("/simulation/environment", payload={"environment_id": preset})
    assert selected["environment"]["id"] == preset
    assert selected["status"] == "idle" and selected["target_index"] == 0
    assert selected["position_z"] != 0
revision = selected["environment_revision"]
for payload, authenticated, status in [
    ({"environment_id": "custom", "config": {"density": 10000}}, True, 422),
    ({"environment_id": "rocky"}, False, 401),
]:
    try:
        request("/simulation/environment", payload=payload, authenticated=authenticated)
        raise AssertionError("Invalid environment request accepted")
    except urllib.error.HTTPError as error:
        assert error.code == status
assert request("/simulation/state")["environment_revision"] == revision
print("Environment switching, validation, and authentication: passed", flush=True)
command("reset")
command("start")
time.sleep(0.4)
paused = command("pause")
time.sleep(0.3)
assert request("/simulation/state")["position_x"] == paused["position_x"]
command("estop")
try:
    command("start")
    raise AssertionError("Emergency stop did not latch")
except urllib.error.HTTPError as error:
    assert error.code == 409
print("Pause and emergency stop: passed", flush=True)
command("demo")
seen = set()
for _ in range(360):
    state = request("/simulation/state")
    if state["status"] not in seen:
        seen.add(state["status"])
        print(
            f"Guided demo: {state['status']} ({state['target_index']}/4 checkpoints)",
            flush=True,
        )
    if state["status"] == "completed":
        assert state["target_index"] == 4
        assert "avoiding" in seen
        assert "blocked" not in seen
        assert state["obstacle"] is not None
        assert [state["position_x"], state["position_y"]] == state["environment"][
            "start"
        ]
        break
    time.sleep(0.5)
else:
    raise AssertionError("Guided demo did not complete within 180 seconds")
command("reset")
print("PASS: full demo completed and reset for presentation.", flush=True)
