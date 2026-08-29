# NAVIGEN

**AI-Based Vision Autonomous Navigation System for Outdoor UGV**

NAVIGEN is an AI-powered vision-based autonomous navigation system for an Unmanned Ground Vehicle (UGV) designed for unknown and unstructured outdoor environments.

## Development Areas

- 🌐 **Web App** — dashboard, telemetry, mission/status integration
- 📱 **Mobile App** — telemetry, alerts, mission/status integration
- 🤖 **NAVIGEN_ugv** — perception, SLAM/localization, path planning, control, safety
- 🔗 **Integration** — shared contracts and end-to-end system integration

## Project Management

NAVIGEN uses GitHub Issues as the primary engineering documentation and workflow system.

- **[Projects Page](PROJECTS.md)** — complete development structure, roadmap, dependencies, and work areas
- **[Documentation Hub — Issue #1](../../issues/1)** — master issue index
- **[GitHub Project Board Setup — Issue #25](../../issues/25)** — exact native GitHub Projects configuration

## Main Epics

| Area | Epic |
|---|---|
| Web App | [#2](../../issues/2) |
| Mobile App | [#3](../../issues/3) |
| NAVIGEN_ugv | [#4](../../issues/4) |
| Integration | [#5](../../issues/5) |

## UGV Navigation Pipeline

```text
Camera → OpenCV → YOLOv8 → SLAM / Sensor Fusion → A* / RRT → Safety → ESP32 Motor Control
```

## Workflow

```text
Backlog → Ready → In Progress → Blocked → Review → Testing → Done
```

See **[PROJECTS.md](PROJECTS.md)** for the complete workflow and roadmap.
