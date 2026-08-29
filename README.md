# NAVIGEN — SIH 2026 (SIH26126)

Vision-based GPS-denied autonomous navigation platform for an outdoor Unmanned Ground Vehicle.

**CAMERA IS THE PRIMARY SENSOR. VISION DOES THE NAVIGATION. GPS IS NEVER A NAVIGATION INPUT.**

## Repository structure

```
NAVIGEN/
├── web_app/       # Operator web dashboard (frontend, backend/API, telemetry, UGV integration)
├── mobile_app/    # Mobile companion app (UI, auth/settings, telemetry, notifications)
└── navigen_ugv/   # The autonomous UGV itself (ROS 2 Jazzy) — START HERE
```

| UGV module | Where it lives |
|---|---|
| Camera / Vision, Object Detection | `navigen_ugv/ros2_ws/src/navigen_perception` |
| SLAM / Localization, Sensor Fusion | `navigen_ugv/ros2_ws/src/navigen_localization` |
| Path Planning | `navigen_ugv/ros2_ws/src/navigen_navigation` |
| ESP32 Communication, Motor Control | `navigen_ugv/ros2_ws/src/navigen_hardware` + `navigen_ugv/firmware` |
| Safety | `navigen_ugv/ros2_ws/src/navigen_safety` |
| Telemetry | `navigen_ugv/ros2_ws/src/navigen_interfaces` + ESP32 bridge |
| Testing | per-package tests + `navigen_ugv/tests` |

Full UGV documentation (setup, build, calibration, demo): [navigen_ugv/README.md](navigen_ugv/README.md).

Web and mobile apps consume UGV telemetry through a bridge on the Raspberry Pi
(e.g. rosbridge_suite / WebSocket); they are operator tools only and are NEVER in the
autonomy control loop — the safety supervisor and ESP32 watchdog remain authoritative.

> Note: directory names use snake_case (no spaces) because colcon, CMake and most CI tooling
> break on paths containing spaces.
