# NAVIGEN — Vision-Based Autonomous Navigation for an Outdoor UGV


> **Current physical hardware (2026-09-30):** Raspberry Pi + Pi Camera, NodeMCU ESP8266, one L298N, four motors without encoders, and one rear ultrasonic sensor. The runnable camera-driving code and setup are in [navigen_ugv/pi_controller/README.md](navigen_ugv/pi_controller/README.md). The ROS/Gazebo roadmap below predates this hardware profile.

Vision-based GPS-denied autonomous navigation platform for an outdoor Unmanned Ground Vehicle.
=======
**Smart India Hackathon 2026 — Problem Statement SIH26126**  
**Vision Based Autonomous Navigation for Unmanned Ground Vehicle for Outdoor Environment**


NAVIGEN is a vision-first autonomous navigation platform for a 4WD Unmanned Ground Vehicle (UGV) designed to operate outdoors **without GPS as a navigation input**. The system is being developed around a Raspberry Pi 5, Raspberry Pi camera, MPU6050 IMU, NodeMCU ESP8266 motor controller, L298N motor driver, and a 4WD skid-steer chassis.

> **Core principle:** Camera/vision is the primary navigation sensor. Other sensors improve localization, robustness, and safety. GPS is never part of the navigation pipeline.

## Current Project Status

**Overall engineering completion: 44%**  
**Current milestone: Phase 5 — Real UGV teleoperation**  
**Phase 5 status: Software green, physical wiring/power gate blocked**

The software foundation and simulation stack are substantially implemented. The project has completed the repository/ROS foundation, Gazebo simulation, simulated Nav2 point-to-point navigation, and the ESP8266 motor-control/serial software stack. The next immediate work is to safely complete the physical motor-power and wiring validation before moving into IMU, perception, and visual SLAM.

### Phase Progress

| Phase | Scope | Status | Completion |
|---|---|---:|---:|
| 1 | Repository, ROS 2 packages, URDF, TF, configuration | ✅ GREEN | 100% |
| 2 | Gazebo Harmonic simulation + teleoperation | ✅ GREEN | 100% |
| 3 | Nav2 point-to-point autonomous simulation | ✅ GREEN | 100% |
| 4 | NodeMCU ESP8266 firmware + Raspberry Pi serial bridge | ✅ GREEN | 100% |
| 5 | Real UGV teleoperation | 🟨 SOFTWARE GREEN / HARDWARE BLOCKED | 80% |
| 6 | MPU6050 + visual-odometry-ready EKF | ⬜ NOT STARTED | 0% |
| 7 | Camera + traversability perception | ⬜ NOT STARTED | 0% |
| 8 | Visual SLAM / visual-inertial odometry | ⬜ NOT STARTED | 0% |
| 9 | Traversability → Nav2 costmap | ⬜ NOT STARTED | 0% |
| 10 | Collision avoidance + safety supervisor | ⬜ NOT STARTED | 0% |
| 11 | Full outdoor A→B autonomous demonstration | ⬜ NOT STARTED | 0% |

Detailed engineering evidence and the acceptance gates are maintained in [`navigen_ugv/PROJECT_PROGRESS.md`](navigen_ugv/PROJECT_PROGRESS.md).

## What Has Been Implemented

### 1. ROS 2 / Robot Foundation — Complete

- ROS 2 Jazzy workspace and eight project packages
- 4WD skid-steer UGV URDF/xacro
- Configurable robot, camera, IMU, and ultrasonic transforms
- Real and simulation robot descriptions
- TF validation and automated package tests
- Reproducible build/test tooling

### 2. Outdoor Gazebo Simulation — Complete

- Gazebo Harmonic simulation
- Self-contained outdoor environment with terrain/obstacles
- Same robot xacro used for simulation and real hardware
- Camera and IMU simulation
- `/cmd_vel`, odometry, TF, joint states and sensor topics
- RViz and headless launch modes
- Deterministic simulation/integration tests

### 3. Autonomous Navigation in Simulation — Complete

The simulated UGV can perform point-to-point navigation using Nav2.

- Known-map navigation baseline
- `SmacPlanner2D` global planner
- `RegulatedPurePursuitController`
- Static and inflation costmaps for the Phase 3 known map
- Recovery behavior tree and lifecycle management
- RViz goal selection
- Collision-free acceptance run to approximately 7 m in the test environment
- Simulation-only `map → odom` bootstrap; **no GPS is used**

> The current simulation navigation is a development baseline. The final system is intended to replace the simulation localization/bootstrap with visual-inertial localization and camera-derived environmental information.

### 4. ESP8266 Motor-Control Stack — Software Complete

The hardware controller has been adapted to the available **NodeMCU 1.0 / ESP8266 (`nodemcuv2`)** and one L298N motor driver.

- Versioned CRC-8 serial protocol v2
- Raspberry Pi ↔ ESP8266 communication
- Bounded left/right open-loop PWM control
- Direction control and configurable side trim
- 300 ms communication watchdog
- Software e-stop and startup inhibition
- One centered HC-SR04 on the ESP8266
- Motor-power feedback input
- Protocol validation and reconnect handling
- Honest encoderless telemetry — no fabricated wheel odometry
- Native firmware and ROS integration tests

The firmware intentionally remains safety-locked until the physical wiring and electrical configuration have been reviewed and confirmed.

### 5. Real UGV Teleoperation — In Progress

The real-hardware software path is implemented and tested through mock/protocol validation. A replacement ESP8266 has been flashed and verified to provide protocol-v2 telemetry with motor output disabled.

The remaining physical gate includes:

- Confirming a suitable, current-rated **3–6 V motor power source**
- Using a separate regulated USB-C supply for the Raspberry Pi
- Measuring/recording motor and L298N electrical limits
- Reworking and insulating the physical power-switch wiring
- Meter-checking motor-driver signals, common grounds, HC-SR04 ECHO divider, and motor-power feedback
- Confirming the exact motor/chassis geometry
- Arming the firmware only after the electrical review
- Testing direction, PWM trim, software stop, physical power cut, watchdog stop, reconnect, and conservative lifted-wheel teleoperation

The photographed three-cell 18650 holder is **not used for the motor rail** under the current no-buck configuration.

## Planned Autonomous Architecture

```text
                    ┌──────────────────────────┐
                    │   Raspberry Pi 5          │
                    │   Ubuntu 24.04 + ROS 2    │
                    │   Jazzy                    │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
          Camera              MPU6050          Other safety
              │                  │              observations
              ▼                  ▼                  │
       Vision / Perception   Visual-Inertial        │
       Traversability        Localization            │
              │                  │                  │
              └──────────┬───────┴──────────────────┘
                         ▼
                  Nav2 / Costmaps
                         │
                    Path Planning
                         │
                      /cmd_vel
                         ▼
                 Safety Supervisor
                         │
                  USB Serial v2
                         │
                         ▼
                 NodeMCU ESP8266
                         │
                   L298N Motor Driver
                         │
                         ▼
                     4WD UGV
```

### Intended final navigation pipeline

**Camera → visual perception / traversability → visual-inertial localization → costmap → Nav2 planning/control → safety supervisor → ESP8266 motor controller → 4WD UGV**

GPS is deliberately excluded from this pipeline.

## Repository Structure

```text
NAVIGEN/
├── navigen_ugv/       # Autonomous UGV — main development area
│   ├── ros2_ws/       # ROS 2 Jazzy workspace and packages
│   ├── firmware/      # ESP8266 motor-controller firmware
│   ├── simulation/    # Gazebo worlds and simulation assets
│   ├── models/        # Robot/simulation models
│   ├── config/        # Configuration files
│   ├── scripts/       # Build, validation, teleop and safety scripts
│   ├── tests/         # Cross-package/project tests
│   ├── docs/          # Architecture, hardware, calibration and troubleshooting docs
│   ├── README.md      # Detailed UGV setup and operation guide
│   └── PROJECT_PROGRESS.md  # Engineering progress and acceptance evidence
│
├── web_app/           # Operator dashboard / telemetry tools
└── mobile_app/        # Mobile companion / operator tools
```

The web and mobile applications are intended as **operator interfaces only**. They consume UGV telemetry and are not part of the autonomous control loop. Safety and motor-control authority remain on the UGV side.

## Technology Stack

- **Robot computer:** Raspberry Pi 5
- **OS:** Ubuntu 24.04 64-bit
- **Robotics framework:** ROS 2 Jazzy
- **Simulation:** Gazebo Harmonic
- **Navigation:** Nav2
- **Primary navigation sensor:** Monocular Raspberry Pi Camera
- **IMU:** MPU6050
- **Motor controller:** NodeMCU 1.0 / ESP8266
- **Motor driver:** L298N
- **Drive:** 4WD skid-steer, encoderless geared motors
- **Obstacle/safety sensor:** HC-SR04
- **Planned visual localization:** ORB-SLAM3 / visual-inertial odometry adapter
- **Communication:** USB serial with versioned CRC-8 protocol

## Safety and Engineering Principles

- **No GPS navigation dependency.**
- Test autonomous behavior in simulation before physical autonomous operation.
- Physical e-stop/power cutoff must remain reachable during testing.
- ESP8266 watchdog stops motor output when valid commands are lost.
- Navigation commands pass through a safety layer before reaching the motor controller.
- Real hardware must never publish invented encoder/wheel odometry when encoders are absent.
- Physical electrical measurements and wiring verification are required before arming the motor controller.
- Initial motor tests are performed with the wheels lifted from the ground.
- Camera remains rigidly mounted for visual localization.

## Current Development Direction

The project is intentionally being developed in gated phases rather than treating the final autonomous demo as already complete.

**Completed foundation:** ROS/URDF → simulation → Nav2 simulation → ESP8266 motor-control software.

**Current priority:** safely complete real UGV teleoperation and hardware validation.

**Next major software stages:** MPU6050 integration → camera/perception → visual-inertial localization → traversability costmap → safety supervisor → full outdoor autonomous A→B demonstration.

## Documentation

- [Detailed UGV README](navigen_ugv/README.md) — setup, build, simulation, hardware, calibration and operation
- [Project Progress Log](navigen_ugv/PROJECT_PROGRESS.md) — phase gates, evidence, blockers and engineering history
- [Architecture](navigen_ugv/docs/architecture.md)
- [Hardware](navigen_ugv/docs/hardware.md)
- [Calibration](navigen_ugv/docs/calibration.md)
- [Troubleshooting](navigen_ugv/docs/troubleshooting.md)

## Contributors / Team Contributions

**Nikhil Chhetri** — AI / Full-Stack / DevOps Developer

- Worked on autonomous navigation system development
- Computer vision and perception pipeline
- Gazebo-based UGV simulation and testing
- Backend/API integration
- Docker-based deployment
- Integration and testing of the overall system

## Status Note

This README describes the **actual current engineering state**, not the intended final feature set. The full autonomous outdoor demonstration is a future acceptance target and is not yet complete. Phase status and completion estimates should be updated in `navigen_ugv/PROJECT_PROGRESS.md` as new gates are passed.
