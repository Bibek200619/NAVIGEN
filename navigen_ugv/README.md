# NAVIGEN UGV — current hardware and ROS research track

> **Current physical prototype (2026-09-30):** Camera-assisted manual driving on a Raspberry Pi 5 and USB-connected NodeMCU ESP8266. The Pi Camera, rear ultrasonic telemetry, and MPU-6500-compatible motion readings work in the [operator dashboard](pi_controller/README.md). Motor output is locked because the 3S pack currently feeds 12.6 V directly to 3–6 V motors. Keep the physical motor switch off. The ROS/Gazebo autonomous-navigation plan below is separate from this deployed runtime.

Smart India Hackathon 2026 — Problem Statement **SIH26126**: Vision Based Autonomous Navigation for Unmanned Ground Vehicle for Outdoor Environment.

**Research goal:** camera-led navigation without GPS. The physical UGV currently depends on a human operator watching the camera; visual autonomy has not been deployed.

## 1. Planned autonomous architecture

```
Camera ─> perception / traversability ─> costmap ─┐
Camera + IMU ─> visual-inertial odometry ─> pose ──┼─> Nav2
Goal ──────────────────────────────────────────────┘      │
                                              safety supervisor
                                                       │
                                         ESP8266 serial motor bridge
                                                       │
                                            motor driver → 4WD UGV
```

This diagram is the **planned autonomous architecture**, not the active Pi dashboard. See [docs/architecture.md](docs/architecture.md) for the research node/topic/TF design.

## 2. Current hardware and research dependencies

- Raspberry Pi 5 running Ubuntu 24.04 64-bit; ROS 2 Jazzy is for the research track, not the deployed dashboard
- Raspberry Pi Camera (monocular, rigidly mounted)
- NodeMCU 1.0 ESP8266 (`ESP8266MOD` / ESP-12E), USB serial to the Pi
- 4WD skid-steer chassis with four encoderless 3-6 V, 200 RPM BO geared motors
- one L298N: channel A drives the left pair, channel B drives the right pair
- Pi I²C motion module with MPU-6500-compatible ID `0x70` at address `0x68`, and one **rear** HC-SR04 on the ESP8266
- one suitably rated physical motor-power cutoff switch
- a three-cell 18650 pack (3S) presently wired directly to the L298N, measured at **12.6 V**; this motor rail is unsafe for the 3–6 V motors and remains locked out
- a separate regulated USB-C supply for the Pi; motor propulsion requires a measured ≤6 V rail and a driver with current margin

Details and wiring assumptions: [docs/hardware.md](docs/hardware.md).

## 3. Wiring / Interface Assumptions

- ESP8266 owns motor PWM/direction, one rear ultrasonic sensor, and the watchdog. D0 is assigned to the buzzer, so motor-switch feedback is disabled; the physical switch must cut motor power independently.
- Raspberry Pi talks to it through a versioned CRC-8 USB-serial protocol.
- Camera and MPU-6500-compatible sensor connect to the Raspberry Pi. The camera stays fixed; sensor tilt/turn rate is displayed but does not provide localization.
- The reviewed NodeMCU pin map and arming flag are centralized in
  `firmware/esp8266_motor_controller/include/board_config.h`.
- No encoder exists. Real/mock hardware never publishes fake `/wheel/odom`; camera/IMU telemetry does not make autonomous ground operation ready.

## 4. Ubuntu Setup for the ROS research track

The deployed Pi keeps its existing Ubuntu 24.04 card and uses a [source-built camera stack](pi_controller/ubuntu24-camera.md). The commands in sections 4–9 below describe the separate ROS research track; they are not required for the [manual-driving dashboard](pi_controller/README.md). For a new ROS installation, flash Ubuntu 24.04 64-bit (server or desktop), then:

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

The checked-in target is NodeMCU 1.0 with one L298N. Firmware was flashed and
verified on the connected ESP8266 with `HARDWARE_CONFIGURATION_CONFIRMED=0`;
USB telemetry and the rear sensor are live, but motor commands are inhibited.
The 3S pack **is currently connected directly** to the L298N motor rail and
was measured at 12.6 V. Keep its physical switch off. A 127/255 PWM duty cap
does not make that supply safe for 3–6 V motors. Fit and measure a suitable
lower-voltage motor rail, review driver current and thermal limits, then follow
the [firmware commissioning guide](firmware/esp8266_motor_controller/README.md#configure-before-arming)
before changing the confirmation flag.

```bash
cd firmware/esp8266_motor_controller
../../scripts/validate_firmware.sh
pio run -e nodemcuv2 -t upload
```

Keep ENA/ENB jumpers installed for the present L298N profile; firmware PWM-drives
IN1–IN4. The present buzzer on D0 has not been electrically validated and stays
off by default. See the [current pin map](firmware/esp8266_motor_controller/README.md#fixed-team-pin-profile)
before changing wiring or connecting motor power.

## 11. ROS Real-UGV Launch (research path)

This ROS launch is a separate research path; the currently deployed physical
interface is the [Pi browser dashboard](pi_controller/README.md). Test the ROS
composition against protocol-backed mock hardware first:

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

The available motors have no encoders. Do not enter invented ticks/revolution or derive
odometry from commands. Camera/IMU localization is future research, not a deployed
source of pose for the current manual vehicle. If encoders are added later,
they require a separately reviewed controller/firmware profile.

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
- The current manual dashboard limits requested speed conservatively; the 0.4 m/s figure in older ROS simulation configurations is not a validated physical speed.
- The ESP8266 watchdog stops PWM after ~300 ms without valid commands.
- The physical switch must cut L298N motor power independently; GPIO feedback is additional.
- The physical firmware has a rear guard and command-loss watchdog. The fuller ROS safety supervisor belongs to the research track and has not been validated for autonomous physical driving.
- Lift wheels off the ground for the first powered motor test.

## Historical autonomous-development phases

The table below is the older ROS/autonomy plan. It does not supersede the
current manual-drive status at the top of this README. Detailed historical
evidence and the activity log are in [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md).

| Phase | Scope | Status |
|---|---|---|
| 1 | Repo, packages, URDF, TF, config | ✅ Green (`787917e`) |
| 2 | Gazebo sim + teleop | ✅ Green (`edd8468`) |
| 3 | Nav2 point-to-point (sim) | ✅ Green (see `PROJECT_PROGRESS.md`) |
| 4 | NodeMCU ESP8266 open-loop firmware + serial bridge | ✅ Software green (see `PROJECT_PROGRESS.md`) |
| 5 | Real teleop | 🟨 Software gate green; physical UGV validation pending |
| 6 | Pi motion telemetry works; ROS visual-odometry-ready EKF remains future work | 🟨 |
| 7 | Camera + perception | ⬜ |
| 8 | ORB-SLAM3 | ⬜ |
| 9 | Traversability → costmap | ⬜ |
| 10 | Safety supervisor integration | ⬜ |
| 11 | Full outdoor A→B demo | ⬜ |
