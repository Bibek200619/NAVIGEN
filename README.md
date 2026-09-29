# NAVIGEN — Vision-Based Autonomous Navigation for an Outdoor UGV

[![Smart India Hackathon 2026](https://img.shields.io/badge/SIH-2026-orange.svg)](https://www.sih.gov.in/)
[![Problem Statement](https://img.shields.io/badge/Problem%20Statement-SIH26126-blue.svg)](#smart-india-hackathon-2026--sih26126)
[![ROS 2](https://img.shields.io/badge/ROS%202-Jazzy-22314E.svg)](https://docs.ros.org/en/jazzy/)
[![Gazebo](https://img.shields.io/badge/Gazebo-Harmonic-FF6F00.svg)](https://gazebosim.org/)
[![Firmware](https://img.shields.io/badge/Firmware-ESP8266%20PlatformIO-orange.svg)](navigen_ugv/firmware/esp8266_motor_controller/)
[![Tests](https://img.shields.io/badge/Core%20Tests-39%2F39%20Passing-brightgreen.svg)](navigen_ugv/scripts/validate_core.py)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

> **Smart India Hackathon 2026 — Problem Statement SIH26126**  
> **Vision Based Autonomous Navigation for Unmanned Ground Vehicle for Outdoor Environment**

NAVIGEN is a vision-first, GPS-denied autonomous navigation platform for a 4WD Unmanned Ground Vehicle (UGV) engineered for rugged outdoor environments. The system delivers reliable localization, obstacle avoidance, and point-to-point transit **without any reliance on GPS**.

> ⚡ **Core Engineering Principle:**  
> **Camera / computer vision is the primary navigation sensor.** Auxiliary sensors (IMU, rear ultrasonic rangefinder, and proximity buzzer) improve localization robustness, fault detection, and collision prevention. **GPS is strictly excluded from the navigation pipeline.**

---

## Table of Contents

- [Current Engineering Status](#current-engineering-status)
- [Quick Start Guide](#quick-start-guide)
  - [1. Run Core Validation (No ROS Required)](#1-run-core-validation-no-ros-required)
  - [2. Interactive 3D Web Simulation & Guided Demo](#2-interactive-3d-web-simulation--guided-demo)
  - [3. Standalone On-Robot Pi Controller (Hardware or Mock)](#3-standalone-on-robot-pi-controller-hardware-or-mock)
  - [4. Full ROS 2 Jazzy & Gazebo Harmonic Simulation](#4-full-ros-2-jazzy--gazebo-harmonic-simulation)
  - [5. Operator Web Dashboard](#5-operator-web-dashboard)
- [System Architecture](#system-architecture)
  - [Autonomous ROS 2 Navigation Pipeline](#autonomous-ros-2-navigation-pipeline)
  - [On-Robot Pi Controller & ESP8266 Telemetry Loop](#on-robot-pi-controller--esp8266-telemetry-loop)
- [Hardware Platform](#hardware-platform)
  - [Component Overview](#component-overview)
  - [Power & Electrical Isolation](#power--electrical-isolation)
- [Repository Structure](#repository-structure)
- [Development Phases & Milestones](#development-phases--milestones)
- [Safety & Failsafe Architecture](#safety--failsafe-architecture)
- [Contributors & Team](#contributors--team)
- [Documentation Index](#documentation-index)

---

## Current Engineering Status

```
[==================== 44% Overall Engineering Completion ====================]
  Phase 1: ROS 2 Foundation & URDF         [████████████████████] 100% (Green)
  Phase 2: Gazebo Harmonic Simulation      [████████████████████] 100% (Green)
  Phase 3: Nav2 Simulation (Known Map)     [████████████████████] 100% (Green)
  Phase 4: NodeMCU ESP8266 Firmware v2     [████████████████████] 100% (Green)
  Phase 5: Real UGV Teleoperation          [████████████████    ]  80% (Software Green / Hardware Power Gate)
  Phase 6-11: VIO, Traversability & Demo   [                    ]   0% (In Roadmap)
```

- **Core Tests:** **39/39 passing** via portable pytest test runner (`scripts/validate_core.py`) verifying serial protocol v2, packet parser, CRC-8 framing, kinematics, and controller HTTP API.
- **Physical Hardware Runtime (`navigen_ugv/pi_controller`):** Standalone camera-assisted manual driving runtime complete on Raspberry Pi 5 with Picamera2 streaming, dead-man motion leases, software e-stop, rear-guard distance telemetry, browser-configurable proximity buzzer (30 cm default), and hardware-in-the-loop mock mode.
- **Interactive 3D Web Simulation (`web_app/simulation`):** Standalone Three.js + FastAPI 3D off-road simulation featuring Alpine, Rocky, and Forest terrains, procedural generation, dynamic obstacle avoidance detour, and guided demonstration.
- **Hardware Status:** Software validation is green. Physical wheel driving remains safely locked until physical electrical wiring, DC motor load switch insulation, and separate 3–6V battery rails are verified.

---

## Quick Start Guide

### 1. Run Core Validation (No ROS Required)

Run the fast unit and integration tests covering the serial protocol v2, CRC-8 integrity, kinematics, mock controller, and HTTP API endpoints:

```bash
# Run 39 portable core tests in ~2 seconds
python3 navigen_ugv/scripts/validate_core.py
```

---

### 2. Interactive 3D Web Simulation & Guided Demo

Experience the off-road UGV patrolling uneven ground with dynamic obstacle rerouting:

```bash
cd web_app
./simulation/start.sh
```

- **3D World Viewer:** [http://127.0.0.1:8010](http://127.0.0.1:8010)
- **Operator Dashboard:** [http://127.0.0.1:5174](http://127.0.0.1:5174)
- Click **"Run guided demo"** to observe the rover navigate terrain, detect a boulder obstacle, take an autonomous detour, and return to base camp.

---

### 3. Standalone On-Robot Pi Controller (Hardware or Mock)

The Pi controller provides camera streaming and keyboard/touch driving without requiring a full ROS 2 environment:

```bash
# Option A: Run in Mock Mode (no physical hardware or serial port needed)
python3 navigen_ugv/pi_controller/app.py --mock

# Option B: Run on physical Raspberry Pi 5 connected to ESP8266
python3 navigen_ugv/pi_controller/app.py \
  --port /dev/serial/by-id/YOUR_ESP8266 \
  --track-width 0.34
```

1. Open `http://127.0.0.1:8080`.
2. Paste the session bearer token generated in the terminal.
3. Drive with **W/A/S/D** or touch controls (hold-to-drive safety leases).
4. Monitor rear ultrasonic telemetry and adjust buzzer thresholds in real time.

---

### 4. Full ROS 2 Jazzy & Gazebo Harmonic Simulation

Launch the complete ROS 2 Gazebo Harmonic outdoor simulation with camera, IMU, and TF transforms:

```bash
# In Ubuntu 24.04 with ROS 2 Jazzy:
cd navigen_ugv/ros2_ws
colcon build --symlink-install
source install/setup.bash

# Launch outdoor world simulation with RViz
ros2 launch navigen_bringup sim.launch.py

# Launch Phase 3 autonomous Nav2 point-to-point navigation
ros2 launch navigen_navigation nav2_sim.launch.py
```

*Prefer Docker?* Run headless or VNC-enabled containers:
```bash
./navigen_ugv/scripts/validate_in_docker.sh
```

---

### 5. Operator Web Dashboard

The production React + TypeScript operator interface for monitoring telemetry and camera feeds:

```bash
# Frontend
cd web_app/frontend
npm install
npm run dev
# Dashboard accessible at http://127.0.0.1:5173

# Backend
cd web_app/backend
uvicorn app.main:app --reload
```

---

## System Architecture

NAVIGEN features a dual-track architectural design:
1. **Autonomy Stack (ROS 2 Jazzy):** Designed for vision-based visual-inertial odometry (VIO), costmap generation, and Nav2 path planning.
2. **On-Robot Executive Runtime (`pi_controller`):** Designed for direct, low-latency teleoperation, live video streaming, safety arbitration, and hardware protection directly on Raspberry Pi 5 + ESP8266.

### Autonomous ROS 2 Navigation Pipeline

```text
                  ┌───────────────────────────────┐
                  │   Raspberry Pi 5 (ROS 2)      │
                  └───────────────┬───────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
     [Pi Camera]              [MPU6050]            [Rear HC-SR04]
          │                       │                       │
          ▼                       ▼                       ▼
  Vision Perception        Visual-Inertial Odometry   Rear Range
  Traversability Mask       (ORB-SLAM3 + EKF Fusion)  Telemetry
          │                       │                       │
          └───────────────┬───────┴───────────────────────┘
                          ▼
               Nav2 Costmaps (Local/Global)
                          │
                 SmacPlanner2D Global
                          │
               Regulated Pure Pursuit
                          │
                       /cmd_vel
                          ▼
                  Safety Supervisor
               (Watchdog / E-Stop Gate)
                          │
                   USB Serial v2 (CRC-8)
                          │
                          ▼
                 NodeMCU ESP8266
             (Watchdog & Rear Guard)
                          │
                  L298N Motor Driver
                          │
                          ▼
            4WD Skid-Steer Geared Motors
```

### On-Robot Pi Controller & ESP8266 Telemetry Loop

```text
  [Operator Browser] ──(HTTP / MJPEG)──> [Pi Controller app.py]
          │                                      │
     Hold-to-drive                           Picamera2
     Motion Leases                               │
          │                                      ▼
          └──────> [controller.py] ──(USB Serial CRC-8 v2)──> [ESP8266 Firmware]
                          │                                           │
                   Active Leases                                 IN1-IN4 PWM
                   Rear Distance                                 Watchdog (300ms)
                   Buzzer Threshold                              Rear Proximity Buzzer
                   Software E-Stop                               Motor-Power Sense
```

---

## Hardware Platform

### Component Overview

| Subsystem | Component | Specifications / Notes |
|---|---|---|
| **SBC (Mission Computer)** | Raspberry Pi 5 (8 GB) | Ubuntu 24.04 LTS 64-bit / Raspberry Pi OS. Hosts perception, Picamera2, and bridge. |
| **Vision Sensor** | Monocular Raspberry Pi Camera | Rigidly mounted forward-facing; primary sensor for odometry and traversability. |
| **Motor Controller** | NodeMCU 1.0 (ESP8266 ESP-12E) | Executes realtime motor PWM, 300 ms watchdog, rear guard, and CRC-8 framing. |
| **Motor Driver** | L298N Dual H-Bridge | Channel A drives Left pair; Channel B drives Right pair. |
| **Drivetrain** | 4WD Skid-Steer Chassis | Four 3–6V 200 RPM BO geared motors (encoderless). |
| **Inertial Measurement** | MPU6050 6-DOF IMU | Connected via I2C to Raspberry Pi; 3-axis gyro + 3-axis accelerometer for EKF fusion. |
| **Rear Range & Alert** | HC-SR04 + Active Buzzer | Dedicated rear obstacle detection; active buzzer sounds within configurable threshold (default: 30 cm). |
| **Communication** | High-speed USB Serial | 115,200 baud, versioned binary protocol with CRC-8 checksumming and sequence validation. |

### Power & Electrical Isolation

To guarantee system stability, electrical noise immunity, and prevent brownouts:
- **Logic Rail:** Powered independently via dedicated regulated 5V USB-C power bank for the Raspberry Pi 5.
- **Motor Rail:** Dedicated 3–6V high-current battery pack feeding the L298N power terminal through a physical master power switch.
- **Common Ground:** Logic ground and motor ground are tied at a single star point on the L298N driver board.
- ⚠️ **High Voltage Notice:** Direct connection of 3S 18650 packs (11.1–12.6V) to 3–6V BO motors without a calibrated DC-DC buck converter is strictly forbidden.

---

## Repository Structure

```text
NAVIGEN/
├── navigen_ugv/                     # Autonomous UGV & Embedded Subsystem
│   ├── pi_controller/               # Standalone on-robot web dashboard & driving service
│   │   ├── app.py                   # HTTP API, auth tokens, lifecycle
│   │   ├── controller.py            # Serial worker, motion leases, rear guard
│   │   ├── camera.py                # Picamera2 capture & JPEG streaming
│   │   ├── static/                  # Responsive browser driving controls
│   │   └── navigen-dashboard@.service # Systemd service template
│   ├── firmware/                    # Embedded microcontrollers
│   │   └── esp8266_motor_controller/ # PlatformIO NodeMCU firmware (PWM, watchdog, buzzer)
│   ├── ros2_ws/                     # Complete ROS 2 Jazzy workspace
│   │   └── src/
│   │       ├── navigen_bringup/     # Sim and real launch compositions
│   │       ├── navigen_description/ # 4WD URDF/xacro, vehicle geometry, TF
│   │       ├── navigen_gazebo/      # Gazebo Harmonic world & bridges
│   │       ├── navigen_hardware/    # Kinematics, serial protocol v2, mock hardware
│   │       ├── navigen_interfaces/  # Custom ROS 2 msg definitions
│   │       ├── navigen_localization/# EKF & planned ORB-SLAM3 integration
│   │       ├── navigen_navigation/  # Nav2 parameters, SmacPlanner2D, costmaps
│   │       └── navigen_safety/      # Safety supervisor & command arbiter
│   ├── simulation/                  # Gazebo Harmonic worlds, terrains & assets
│   ├── docker/                      # Dockerized development environments
│   ├── scripts/                     # validate_core.py, teleop.sh, estop.sh, etc.
│   └── docs/                        # architecture.md, hardware.md, calibration.md
│
├── web_app/                         # Operator Command & Telemetry Subsystems
│   ├── frontend/                    # React + TypeScript + Vite operator dashboard
│   ├── backend/                     # FastAPI backend with WebSocket telemetry
│   ├── simulation/                  # Interactive 3D Three.js off-road demo server
│   ├── shared/                      # Versioned JSON contracts & example payloads
│   └── docs/                        # LIVE_CAMERA.md, ARCHITECTURE.md, etc.
│
└── mobile_app/                      # Mobile companion application (spec & roadmap)
```

---

## Development Phases & Milestones

The project follows a rigorous, gated phase progression where each phase requires verifiable test evidence:

| Phase | Milestone Scope | Status | Acceptance Evidence |
|:---:|---|:---:|---|
| **1** | Repository, ROS 2 Workspace, URDF, TF | ✅ **GREEN (100%)** | 8 packages build cleanly under ROS 2 Jazzy; URDF/xacro and TF tree verified. |
| **2** | Gazebo Harmonic Simulation & Teleop | ✅ **GREEN (100%)** | Realistic outdoor world, terrain obstacles, simulated camera/IMU, bounded motion. |
| **3** | Nav2 Point-to-Point Autonomous Simulation | ✅ **GREEN (100%)** | Known-map SmacPlanner2D + Regulated Pure Pursuit; collision-free 7m acceptance run. |
| **4** | NodeMCU ESP8266 Firmware & Serial Protocol | ✅ **GREEN (100%)** | CRC-8 protocol v2, 300 ms watchdog, ultrasonic rear guard, and proximity buzzer. |
| **5** | Real UGV Teleoperation & Pi Dashboard | 🟨 **80% (In Progress)** | Software stack & mock tests complete; physical power switch wiring validation in progress. |
| **6** | MPU6050 IMU + Visual Odometry EKF | ⬜ **0% (Roadmap)** | robot_localization EKF fusion (strictly encoderless; no synthetic wheel ticks). |
| **7** | Vision Traversability Segmentation | ⬜ **0% (Roadmap)** | On-device lightweight neural network for ground plane / terrain classification. |
| **8** | Visual SLAM / Visual-Inertial Odometry | ⬜ **0% (Roadmap)** | ORB-SLAM3 mono/stereo-inertial integration without GPS. |
| **9** | Traversability to Nav2 Costmap Layer | ⬜ **0% (Roadmap)** | Dynamic conversion of vision masks to local costmap obstacles. |
| **10** | Safety Supervisor & Emergency Arbitrator | ⬜ **0% (Roadmap)** | Multi-channel safety supervisor overriding navigation commands. |
| **11** | Full Outdoor A-to-B Autonomous Demo | ⬜ **0% (Final Target)** | GPS-denied autonomous point-to-point outdoor traversal. |

---

## Safety & Failsafe Architecture

1. **Strictly Encoderless Honesty:** Because the physical chassis uses encoderless BO motors, the system **never invents synthetic wheel odometry**. Odometry is derived solely from visual-inertial SLAM and simulation plugins.
2. **Hardware Watchdog:** The ESP8266 firmware shuts down motor PWM if no valid CRC-8 command packet is received within **300 ms**.
3. **Dead-Man Motion Leases:** In manual/teleop modes, command velocity leases automatically expire if the operator releases the key/control or if browser focus is lost.
4. **Rear Obstacle Guard & Active Buzzer:** If the rear ultrasonic sensor detects an obstacle within the threshold (default: 30 cm), reverse drive is inhibited and an active buzzer sounds.
5. **Physical E-Stop Isolation:** A physical dual-pole cutoff switch cuts direct battery power to the L298N driver regardless of software state.

---

## Contributors & Team

NAVIGEN is developed for **Smart India Hackathon 2026**:

- **Bibek Shah** ([@Bibek200619](https://github.com/Bibek200619)) — *Project Lead / Embedded & Full-Stack Developer*  
  ESP8266 firmware development, CRC-8 protocol v2, Raspberry Pi driving runtime, 3D web simulation engine, operator dashboard UI.
- **Nikhil Chhetri** ([@nikhi20-900](https://github.com/nikhi20-900)) — *AI / Robotics & DevOps Developer*  
  Autonomous navigation development, computer vision & perception pipeline, Gazebo Harmonic UGV simulation, backend API integration, Docker deployment environments.
- **Lenin Sarmah** ([@LeninSarmah](https://github.com/LeninSarmah)) — *Frontend & Documentation Contributor*  
  Operator interface refinements, UI alignment, documentation, and progress logging.

---

## Documentation Index

- 📘 [UGV Engineering Guide](navigen_ugv/README.md) — Comprehensive build, ROS 2 configuration, and hardware bringup.
- 📋 [Engineering Progress & Evidence](navigen_ugv/PROJECT_PROGRESS.md) — Detailed acceptance criteria, test reports, and blocker logs.
- 🚗 [Pi Controller & Teleop Runtime](navigen_ugv/pi_controller/README.md) — Setup and operation of the standalone web dashboard.
- ⚡ [ESP8266 Firmware & Pinout](navigen_ugv/firmware/esp8266_motor_controller/README.md) — Pin mapping, PlatformIO setup, and rear guard logic.
- 🏗️ [System Architecture Specification](navigen_ugv/docs/architecture.md) — Node definitions, topics, TF tree, and contracts.
- 🔌 [Hardware & Wiring Guide](navigen_ugv/docs/hardware.md) — Electrical connections, power rails, and sensor wiring.
- 🌐 [Web Application Documentation](web_app/README.md) — Operator dashboard, backend APIs, and shared contracts.
- 🎮 [3D Simulation & Demo Guide](web_app/simulation/README.md) — Interactive Three.js simulation setup and presentation script.
- 📷 [Live Camera Setup](web_app/docs/LIVE_CAMERA.md) — Video streaming gateway and authenticated MJPEG configuration.
- 🛠️ [Troubleshooting & FAQs](navigen_ugv/docs/troubleshooting.md) — Solutions to common hardware, serial, and ROS issues.
