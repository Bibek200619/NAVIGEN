# NAVIGEN Projects

> Unified development overview for the NAVIGEN Web App, Mobile App, Autonomous UGV, and cross-functional integration work.

## Project Overview

NAVIGEN is an AI-powered vision-based autonomous navigation system for an Unmanned Ground Vehicle (UGV) designed for unknown and unstructured outdoor environments.

The project is organized as one product with three primary engineering areas and one shared integration area:

| Area | Purpose | Epic |
|---|---|---|
| 🌐 Web App | Dashboard, telemetry visualization, mission/status interface | [#2](../../issues/2) |
| 📱 Mobile App | Portable telemetry, alerts, mission/status interface | [#3](../../issues/3) |
| 🤖 NAVIGEN_ugv | Perception, localization, planning, control, safety, testing | [#4](../../issues/4) |
| 🔗 Integration | Shared contracts and end-to-end system integration | [#5](../../issues/5) |

Main documentation hub: [#1 — NAVIGEN Project Documentation & Workflow Hub](../../issues/1)

---

# Workflow

All teams follow the same status flow:

```text
Backlog → Ready → In Progress → Blocked → Review → Testing → Done
```

## Priority

| Priority | Meaning |
|---|---|
| P0 | Blocks the NAVIGEN demo or safety-critical operation |
| P1 | Required for the current milestone |
| P2 | Important, but not currently blocking |
| P3 | Improvement / future work |

---

# 🌐 Web App

Epic: [#2](../../issues/2)

| Issue | Work Item | Suggested Priority |
|---|---|---|
| [#16](../../issues/16) | Web architecture & dashboard shell | P1 |
| [#17](../../issues/17) | Live UGV telemetry & health dashboard | P1 |
| [#18](../../issues/18) | Mission status & safe command interface | P1 |

### Web responsibility

- Dashboard UI
- API/service integration
- UGV connection state
- Telemetry visualization
- Mission/navigation state
- Safety/error presentation
- Safe command UI where approved by the shared safety contract

---

# 📱 Mobile App

Epic: [#3](../../issues/3)

| Issue | Work Item | Suggested Priority |
|---|---|---|
| [#19](../../issues/19) | Mobile architecture & core navigation | P1 |
| [#20](../../issues/20) | UGV telemetry, health & connection screen | P1 |
| [#21](../../issues/21) | Safety alerts, notifications & mission status | P1 |

### Mobile responsibility

- Core mobile UI/navigation
- API/service integration
- UGV telemetry
- Connection/offline state
- Mission status
- Safety alerts and notifications

---

# 🤖 NAVIGEN_ugv

Epic: [#4](../../issues/4)

NAVIGEN's autonomous navigation pipeline is organized around:

```text
Camera
  ↓
OpenCV preprocessing
  ↓
YOLOv8 perception
  ↓
SLAM / localization + sensor fusion
  ↓
A* / RRT path planning
  ↓
Safety validation
  ↓
ESP32 / motor control
  ↓
Autonomous movement
```

| Issue | Work Item | Suggested Priority |
|---|---|---|
| [#6](../../issues/6) | UGV software architecture & module contracts | P0 |
| [#7](../../issues/7) | Camera capture & OpenCV preprocessing | P1 |
| [#8](../../issues/8) | YOLOv8 obstacle detection | P1 |
| [#9](../../issues/9) | Outdoor SLAM / localization | P1 |
| [#10](../../issues/10) | IMU + ultrasonic sensor fusion | P1 |
| [#11](../../issues/11) | A* + RRT planning and dynamic re-planning | P1 |
| [#12](../../issues/12) | ESP32 communication & motion control | P0 |
| [#13](../../issues/13) | Emergency stop, watchdogs & failsafe state machine | P0 |
| [#14](../../issues/14) | Telemetry, health monitoring & logging | P1 |
| [#15](../../issues/15) | Simulation, bench & outdoor field validation | P1 |

---

# 🔗 Integration

Epic: [#5](../../issues/5)

| Issue | Work Item | Suggested Priority |
|---|---|---|
| [#22](../../issues/22) | Shared telemetry, mission & command schemas | P0 |
| [#23](../../issues/23) | UGV ↔ Backend ↔ Web/Mobile live data pipeline | P1 |
| [#24](../../issues/24) | Full NAVIGEN integration & demo rehearsal | P1 |

### Integration principle

No team should invent a separate representation of UGV state. Web, Mobile, backend, and NAVIGEN_ugv should use the versioned contracts defined in #22.

---

# Dependency Map

```text
                         #6 Architecture
                     ┌─────────┼───────────┐
                     ↓         ↓           ↓
                 #7 Vision   #10 Sensors  #12 Control
                     ↓         ↓           ↑
                 #8 YOLO      └──→ #9 SLAM
                                   ↓
                               #11 Planning
                                   ↓
                               #13 Safety
                                   ↓
                              #14 Telemetry
                                   ↓
                              #15 Validation

#22 Shared Contracts ──→ #23 Live Pipeline ──→ Web + Mobile
                                             ↓
                                         #24 E2E Demo
```

---

# Milestone Roadmap

| Milestone | Goal |
|---|---|
| M0 — Project Foundation | Architecture, repository workflow, contracts |
| M1 — UGV Base Control | ESP32 communication and safe basic motion |
| M2 — Vision & Obstacle Detection | Camera/OpenCV + YOLO perception |
| M3 — Autonomous Navigation MVP | Localization, sensor fusion, path planning, safety |
| M4 — Web & Mobile MVP | Working application shells and telemetry views |
| M5 — Full System Integration | UGV ↔ backend ↔ Web/Mobile |
| M6 — Outdoor Field Testing | Controlled outdoor validation |
| M7 — Final NAVIGEN Demo | Reproducible end-to-end demonstration |

---

# GitHub Project Board Layout

Native GitHub Project configuration is tracked in [#25](../../issues/25).

Create one Project named **NAVIGEN Development** with these views:

1. **00 — NAVIGEN Command Center** — table grouped by Area
2. **01 — Web App** — board filtered to Web
3. **02 — Mobile App** — board filtered to Mobile
4. **03 — NAVIGEN_ugv** — board filtered to NAVIGEN_ugv
5. **04 — Integration** — board filtered to Integration
6. **05 — NAVIGEN Roadmap** — roadmap/timeline view

Recommended fields:

- Status
- Area
- Priority
- Effort
- Iteration
- Target Date
- Assignee
- Milestone

---

# Team Working Rules

1. Every meaningful piece of work should have an issue.
2. Every coding PR should reference its issue using `Closes #<issue>` when appropriate.
3. Do not mark an issue Done until acceptance criteria and testing are complete.
4. Use integration issue #22 as the source of truth for shared data contracts.
5. Safety-critical UGV changes must explicitly document failure behavior.
6. Field tests must capture logs/evidence and document failures as issues.
7. Cross-team blockers should be linked from both affected issues.

---

# Definition of Done

A NAVIGEN issue is complete when:

- [ ] Acceptance criteria are met
- [ ] Implementation is complete
- [ ] Relevant tests pass
- [ ] Integration impact is checked
- [ ] Safety impact is checked when applicable
- [ ] Documentation/logging is updated
- [ ] PR is reviewed and merged when code is involved

---

## Quick Links

- [Documentation Hub — #1](../../issues/1)
- [Web Epic — #2](../../issues/2)
- [Mobile Epic — #3](../../issues/3)
- [UGV Epic — #4](../../issues/4)
- [Integration Epic — #5](../../issues/5)
- [Project Board Setup — #25](../../issues/25)
