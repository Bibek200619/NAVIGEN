# Testing

## Reproducible Jazzy validation (no hardware required)

On Ubuntu 24.04 with ROS 2 Jazzy installed, use the native commands below. On another host,
including macOS, run the same gate in the supplied Linux container:

```bash
./scripts/validate_in_docker.sh
```

The container copies the source into a temporary workspace, so it does not create root-owned
build artifacts in the repository.

## Native build and unit tests

```bash
cd ros2_ws
colcon build --symlink-install
colcon test
colcon test-result --verbose
```

Current coverage validates xacro expansion, the static TF/link tree, four wheel joints,
simulation plugin/sensor inclusion, the no-GPS invariant, world/bridge assets, and two live
headless Gazebo gates. The Phase 2 test checks sensor/odometry topics and bounded teleoperation.
The Phase 3 test activates the complete Nav2 lifecycle, sends a 7 m `NavigateToPose` goal,
requires Smac's path to deviate around the mapped central obstacle, verifies command limits,
checks arrival tolerance, and requires a final zero command. Phase 4 adds protocol/CRC/sequence,
kinematics, encoder conversion, PID, watchdog, reconnect, mock-controller, and ROS bridge tests.
Phase 5 adds a no-Gazebo real-launch gate that proves startup inhibition, explicit release,
bounded mock motion, encoder odometry, TF, and e-stop override. Later phases add perception in
Phase 7 and full safety arbitration in Phase 10.

## Phase 4 firmware and mock hardware

Compile native protocol/control tests and the pinned ESP32 target:

```bash
./scripts/validate_firmware.sh
```

Run only the ROS bridge tests after building/sourcing the workspace:

```bash
colcon test --packages-select navigen_hardware
colcon test-result --verbose
```

The whole workspace runs without any hardware:

```bash
ros2 launch navigen_hardware esp32_bridge.launch.py mock_hardware:=true
ros2 topic pub -r 20 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.2}}'
ros2 topic echo /motor/telemetry
```

## Phase 5 physical-mode software gate

```bash
ros2 launch navigen_bringup real.launch.py mock_hardware:=true rviz:=false
./scripts/estop.sh release --confirm
./scripts/teleop.sh
./scripts/estop.sh engage

# Focused automated gate:
colcon test --packages-select navigen_bringup \
  --ctest-args -R 'test_real_bringup'
colcon test-result --verbose
```

This proves the software command chain but does not certify motor wiring, encoder polarity,
physical e-stop wiring, USB-loss stopping time, or chassis behavior. Complete and record the
lifted-wheel procedure in [hardware.md](hardware.md) before marking Phase 5 green.

## Simulation smoke test

```bash
ros2 launch navigen_bringup sim.launch.py
./scripts/teleop.sh    # drive around, verify /wheel/odom, /imu/data, /camera/image_raw, TF

# Headless / CI:
ros2 launch navigen_bringup sim.launch.py \
  headless:=true software_rendering:=true rviz:=false

# Run only the automated live simulation gate:
colcon test --packages-select navigen_bringup \
  --ctest-args -R test_test_simulation.launch.py
colcon test-result --verbose
```

## Autonomous Nav2 simulation

```bash
ros2 launch navigen_navigation nav2_sim.launch.py

# In another sourced terminal (equivalent to clicking Nav2 Goal in RViz):
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 7.0, y: 0.0}, orientation: {w: 1.0}}}}"

# Headless Phase 3 acceptance test only:
colcon test --packages-select navigen_navigation \
  --ctest-args -R test_test_navigation.launch.py
colcon test-result --verbose
```

Do not start `navigation.launch.py` with `publish_map_to_odom:=true` if visual SLAM or another
localization source is already publishing `map → odom`.

## Bag replay debugging

```bash
./scripts/record_bag.sh my_run          # on the UGV
ros2 bag play rosbags/my_run --clock    # on any dev machine, with RViz
```

## Per-phase exit criteria

Every phase ends with: `colcon build` clean → `colcon test` green → documented commands →
logically separated commits.
