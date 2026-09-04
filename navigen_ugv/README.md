# NAVIGEN — Vision-Based Autonomous Navigation for an Outdoor UGV

Smart India Hackathon 2026 — Problem Statement **SIH26126**: Vision Based Autonomous Navigation for Unmanned Ground Vehicle for Outdoor Environment.

**Core principle: CAMERA IS THE PRIMARY SENSOR. VISION DOES THE NAVIGATION. OTHER SENSORS IMPROVE ROBUSTNESS AND SAFETY. GPS IS NEVER A NAVIGATION INPUT.**

## 1. System Architecture

```
Camera ─> Preprocess ─> Traversability segmentation ─> Local costmap ─┐
Camera + IMU ─> ORB-SLAM3 mono-inertial VIO ─> /visual_odom ──┐       │
IMU + visual odom ─> robot_localization EKF ──────────────────┴─> /odometry/filtered
                                                                      │
Goal + pose + costmap ─> Nav2 (SmacPlanner2D + RegulatedPurePursuit) ─┘
        ─> /cmd_vel ─> Safety supervisor ─> NodeMCU ESP8266 serial bridge
        ─> bounded left/right open-loop PWM ─> one L298N ─> 4WD motors
```

See [docs/architecture.md](docs/architecture.md) for the full node/topic/TF design.

## 2. Hardware Requirements

- Raspberry Pi 5 (8 GB recommended), Ubuntu 24.04 64-bit, ROS 2 Jazzy
- Raspberry Pi Camera (monocular, rigidly mounted)
- NodeMCU 1.0 ESP8266 (`ESP8266MOD` / ESP-12E), USB serial to the Pi
- 4WD skid-steer chassis with four encoderless 3-6 V, 200 RPM BO geared motors
- one L298N: channel A drives the left pair, channel B drives the right pair
- MPU6050 on Raspberry Pi I2C and one centered HC-SR04 on the ESP8266
- one suitably rated physical motor-power cutoff switch
- a known 3-6 V motor battery and a separate regulated USB-C supply/power bank for the Pi; the
  current no-buck plan excludes the photographed three-cell 18650 holder from propulsion

Details and wiring assumptions: [docs/hardware.md](docs/hardware.md).

## 3. Wiring / Interface Assumptions

- ESP8266 owns motor PWM/DIR, one ultrasonic, watchdog, and motor-power feedback.
- Raspberry Pi talks to it through a versioned CRC-8 USB-serial protocol.
- Camera and MPU6050 connect to the Raspberry Pi; the servos remain disconnected and the camera
  stays fixed for SLAM.
- The reviewed NodeMCU pin map and arming flag are centralized in
  `firmware/esp8266_motor_controller/include/board_config.h`.
- No encoder exists. Real/mock hardware never publishes fake `/wheel/odom`; visual-inertial pose
  is mandatory before autonomous ground operation.

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
./scripts/teleop.sh          # publishes /cmd_vel; bridge enforces configured limits
```

Gazebo and Phase 5 hardware bringup consume the same `/cmd_vel` interface. Real bringup starts
with software e-stop asserted; release it only after the lifted-wheel checks in
[docs/hardware.md](docs/hardware.md).

## 10. NodeMCU ESP8266 Flashing

Phase 4 now targets the photographed NodeMCU 1.0 and one L298N. The checked-in configuration is
deliberately unarmed (`HARDWARE_CONFIGURATION_CONFIRMED=0`). Review wiring, divider voltages,
power ratings, stop behavior, and measured limits before setting it to `1`. The product listing
confirms 3-6 V motors, so the photographed three-cell 18650 holder must not feed the L298N motor
rail directly. Because the current plan uses no buck converter, that holder is not used at all.

```bash
cd firmware/esp8266_motor_controller
../../scripts/validate_firmware.sh
pio run -e nodemcuv2 -t upload
```

Keep ENA/ENB jumpers installed; firmware PWM-drives IN1–IN4. See
[docs/hardware.md](docs/hardware.md) before connecting motor power.

## 11. Real UGV Launch

Test the complete physical composition against protocol-backed mock hardware first:

```bash
ros2 launch navigen_bringup real.launch.py mock_hardware:=true rviz:=true
./scripts/estop.sh release --confirm
./scripts/teleop.sh
./scripts/estop.sh engage
```

After filling and validating every physical parameter, launch using the stable device path shown
by `ls -l /dev/serial/by-id/`:

```bash
ros2 launch navigen_bringup real.launch.py \
  serial_port:=/dev/serial/by-id/<YOUR_NODEMCU> baud_rate:=115200
```

Startup remains inhibited until `./scripts/estop.sh release --confirm`. The bridge commands zero
for stale/invalid input, latches controller e-stop events, asserts e-stop on shutdown, and the
firmware independently stops after approximately 300 ms of communication loss. Physical
validation is not replaceable by mock tests.

## 12. Camera Calibration

Use `ros2 run camera_calibration cameracalibrator` with a checkerboard; store results in
`config/` and reference them from perception + SLAM configs. Full procedure: [docs/calibration.md](docs/calibration.md).

## 13. IMU Calibration

Keep the UGV stationary and level for 30 s, record `/imu/data`, compute gyro/accel biases,
enter them in the IMU driver config. See [docs/calibration.md](docs/calibration.md).

## 14. Encoder Status

The available motors have no encoders. Do not enter invented ticks/revolution and do not derive
odometry from commands. Real localization will use camera + MPU6050 VIO. If encoders are added
later, they require a separate reviewed controller/firmware profile.

## 15. Open-Loop PWM Calibration

On stands, tune only the minimum starting PWM and reduce the faster side with `LEFT_PWM_SCALE` or
`RIGHT_PWM_SCALE`. These are not speed PID gains and cannot remove terrain/load drift. Follow
[docs/calibration.md](docs/calibration.md).

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
- The ESP8266 watchdog stops PWM after ~300 ms without valid commands.
- The physical switch must cut L298N motor power independently; GPIO feedback is additional.
- The safety supervisor overrides navigation whenever any trigger is active; never bypass it.
- Lift wheels off the ground for the first powered motor test.

## Development Phases

The detailed evidence and activity log are maintained in [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md).

| Phase | Scope | Status |
|---|---|---|
| 1 | Repo, packages, URDF, TF, config | ✅ Green (`787917e`) |
| 2 | Gazebo sim + teleop | ✅ Green (`edd8468`) |
| 3 | Nav2 point-to-point (sim) | ✅ Green (see `PROJECT_PROGRESS.md`) |
| 4 | NodeMCU ESP8266 open-loop firmware + serial bridge | ✅ Software green (see `PROJECT_PROGRESS.md`) |
| 5 | Real teleop | 🟨 Software gate green; physical UGV validation pending |
| 6 | MPU6050 + visual-odom-ready EKF (no wheel odom) | ⬜ |
| 7 | Camera + perception | ⬜ |
| 8 | ORB-SLAM3 | ⬜ |
| 9 | Traversability → costmap | ⬜ |
| 10 | Safety supervisor integration | ⬜ |
| 11 | Full outdoor A→B demo | ⬜ |
