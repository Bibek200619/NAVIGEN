# NAVIGEN — Vision-Based Autonomous Navigation for an Outdoor UGV

Smart India Hackathon 2026 — Problem Statement **SIH26126**: Vision Based Autonomous Navigation for Unmanned Ground Vehicle for Outdoor Environment.

**Core principle: CAMERA IS THE PRIMARY SENSOR. VISION DOES THE NAVIGATION. OTHER SENSORS IMPROVE ROBUSTNESS AND SAFETY. GPS IS NEVER A NAVIGATION INPUT.**

## 1. System Architecture

```
Camera ─> Preprocess ─> Traversability segmentation ─> Local costmap ─┐
Camera + IMU ─> ORB-SLAM3 (VIO) ─> /visual_odom ──────────────┐       │
Wheel encoders + IMU + visual odom ─> robot_localization EKF ─┴─> /odometry/filtered
                                                                      │
Goal + pose + costmap ─> Nav2 (SmacPlanner2D + RegulatedPurePursuit) ─┘
        ─> /cmd_vel ─> Safety supervisor ─> ESP32 serial bridge
        ─> left/right wheel PID (ESP32, 100 Hz) ─> motor drivers ─> 4WD motors
```

See [docs/architecture.md](docs/architecture.md) for the full node/topic/TF design.

## 2. Hardware Requirements

- Raspberry Pi 5 (8 GB recommended), Ubuntu 24.04 64-bit, ROS 2 Jazzy
- ESP32 dev board (USB serial to the Pi)
- 4WD skid-steer chassis, 4 DC geared motors with quadrature encoders
- Dual motor drivers (e.g. 2x dual H-bridge), pins fully configurable
- Stereo camera (preferred) or monocular USB / Pi camera
- MPU6050 IMU, 2x front HC-SR04 ultrasonic sensors
- Physical emergency-stop switch cutting motor power

Details and wiring assumptions: [docs/hardware.md](docs/hardware.md).

## 3. Wiring / Interface Assumptions

- ESP32 owns ALL real-time I/O: encoders, motor PWM/DIR, ultrasonics, e-stop input.
- Raspberry Pi talks to the ESP32 only via USB serial (framed binary protocol, CRC-8).
- Camera and IMU connect to the Raspberry Pi (IMU via I2C or via ESP32 — configurable).
- No pin numbers are hard-coded: fill `firmware/esp32_motor_controller/include/board_config.h`.

## 4. Ubuntu Setup

Flash Ubuntu 24.04 64-bit (server or desktop) to the Pi 5, then:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git build-essential cmake python3-pip
sudo usermod -aG dialout $USER   # serial access, re-login afterwards
```

## 5. ROS 2 Installation (Jazzy)

Follow https://docs.ros.org/en/jazzy/Installation/Ubuntu-Install-Debs.html then:

```bash
sudo apt install -y ros-jazzy-desktop ros-dev-tools
echo 'source /opt/ros/jazzy/setup.bash' >> ~/.bashrc
```

## 6. Dependency Installation

```bash
sudo apt install -y \
  ros-jazzy-ros-gz ros-jazzy-robot-localization ros-jazzy-navigation2 \
  ros-jazzy-nav2-bringup ros-jazzy-xacro ros-jazzy-teleop-twist-keyboard \
  ros-jazzy-joint-state-publisher-gui ros-jazzy-cv-bridge \
  python3-serial python3-opencv python3-pytest
# Edge inference (Phase 7): pip install onnxruntime
# ORB-SLAM3 (Phase 8): see docs/calibration.md and navigen_localization/README.md
cd ros2_ws && rosdep install --from-paths src -y --ignore-src
```

## 7. Build Commands

```bash
cd ros2_ws
colcon build --symlink-install
source install/setup.bash
colcon test && colcon test-result --verbose
```

## 8. Gazebo Simulation

```bash
ros2 launch navigen_bringup sim.launch.py            # world + robot + bridge + RViz
ros2 launch navigen_bringup sim.launch.py rviz:=false
ros2 launch navigen_bringup sim.launch.py headless:=true rviz:=false
```

For a container or machine without GPU access, add `software_rendering:=true`. The launch file
also accepts `world`, `world_name`, `spawn_x`, `spawn_y`, `spawn_z`, `spawn_yaw`, `headless`,
`rviz`, and `gz_verbosity`. The supplied outdoor world is self-contained and requires no model
downloads.

Phase 3 autonomous point-to-point simulation:

```bash
ros2 launch navigen_navigation nav2_sim.launch.py
# Select Nav2 Goal in RViz and click a free point in the known local map.
```

## 9. Teleoperation

```bash
./scripts/teleop.sh          # or: ros2 run teleop_twist_keyboard teleop_twist_keyboard
```

The publisher script is available now. Phase 2 supplies its simulation target; Phase 5 supplies
the physical target. Both consume the same `/cmd_vel` interface.

## 10. ESP32 Flashing

Phase 4 provides tested firmware and the ROS bridge. The checked-in board configuration is
deliberately unarmed: fill and verify every required pin, calibration, limit, and PID value before
expecting propulsion.

```bash
cd firmware/esp32_motor_controller
# 1. Fill include/board_config.h (pins, encoders, PID, geometry, safety)
../../scripts/validate_firmware.sh
pio run -t upload            # physical flash; see firmware README safety procedure
```

## 11. Real UGV Launch

The serial bridge is available now; complete physical-UGV composition remains the Phase 5 gate.

```bash
ros2 launch navigen_hardware esp32_bridge.launch.py \
  serial_port:=/dev/ttyUSB0 baud_rate:=115200
ros2 launch navigen_hardware esp32_bridge.launch.py mock_hardware:=true
```

## 12. Camera Calibration

Use `ros2 run camera_calibration cameracalibrator` with a checkerboard; store results in
`config/` and reference them from perception + SLAM configs. Full procedure: [docs/calibration.md](docs/calibration.md).

## 13. IMU Calibration

Keep the UGV stationary and level for 30 s, record `/imu/data`, compute gyro/accel biases,
enter them in the IMU driver config. See [docs/calibration.md](docs/calibration.md).

## 14. Encoder Calibration

Set `ticks_per_revolution` in `ros2_ws/src/navigen_hardware/config/hardware.yaml`.
Validate: push the UGV exactly 1.0 m and compare integrated wheel odometry.

## 15. PID Tuning

Tune left/right velocity PIDs in `board_config.h` (P first, then I, small D), verify with
`/motor/telemetry` setpoint-vs-measured plots. See [docs/calibration.md](docs/calibration.md).

## 16. Visual SLAM Setup (Phase 8)

ORB-SLAM3 will be integrated through an adapter and never vendored. Preferred mode Stereo+IMU,
fallback Mono+IMU. Phase 8 will add tested installation and licensing instructions to
`ros2_ws/src/navigen_localization/README.md`.

## 17. Nav2 Setup

Phase 3 provides SmacPlanner2D + RegulatedPurePursuitController, a Gazebo-aligned known map,
static/inflation costmaps, recovery behavior tree, lifecycle launch, and an RViz Nav2 goal tool.
Run `ros2 launch navigen_navigation nav2_sim.launch.py`; goals are `PoseStamped` values in
`map`. The temporary identity `map → odom` publisher is simulation-only and must be disabled
when Phase 8 visual localization is active. Collision Monitor remains gated to Phase 10.

## 18. Autonomous Demo (Phase 11 acceptance target)

1. Place UGV at Point A (no GPS anywhere in the pipeline).
2. `ros2 launch navigen_bringup real.launch.py` — wait for SLAM state `TRACKING`.
3. In RViz press *2D Goal Pose*, click Point B.
4. The UGV segments traversable terrain, plans, avoids obstacles dynamically and stops at B.
5. RViz shows camera, segmentation, pose, trajectory, costmap, path, goal and safety state.

## 19. Troubleshooting

See [docs/troubleshooting.md](docs/troubleshooting.md).

## 20. Safety Warnings

- ALWAYS test in simulation first. Keep the physical e-stop reachable at all times.
- Default speed limit is 0.4 m/s (configurable, keep it conservative for demos).
- The ESP32 watchdog stops motors after ~300 ms without valid commands.
- The safety supervisor overrides navigation whenever any trigger is active; never bypass it.
- Lift wheels off the ground for the first powered motor test.

## Development Phases

The detailed evidence and activity log are maintained in [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md).

| Phase | Scope | Status |
|---|---|---|
| 1 | Repo, packages, URDF, TF, config | ✅ Green (`787917e`) |
| 2 | Gazebo sim + teleop | ✅ Green (`edd8468`) |
| 3 | Nav2 point-to-point (sim) | ✅ Green (see `PROJECT_PROGRESS.md`) |
| 4 | ESP32 firmware + serial bridge | ✅ Green (see `PROJECT_PROGRESS.md`) |
| 5 | Real teleop | ⬜ |
| 6 | Wheel odom + IMU + EKF | ⬜ |
| 7 | Camera + perception | ⬜ |
| 8 | ORB-SLAM3 | ⬜ |
| 9 | Traversability → costmap | ⬜ |
| 10 | Safety supervisor integration | ⬜ |
| 11 | Full outdoor A→B demo | ⬜ |
