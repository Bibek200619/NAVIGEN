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
simulation plugin/sensor inclusion, the no-GPS invariant, world/bridge assets, and a live
headless Gazebo test. The live test waits for camera, camera info, IMU, wheel odometry, joint
states, clock and odometry TF, then commands 0.2 m/s and requires at least 0.15 m of odometry
motion. Later phase tests add kinematics/serial in Phase 4, perception in Phase 7, and safety in
Phase 10.

## Mock hardware mode (available after Phase 4)

The whole workspace runs without any hardware:

```bash
ros2 launch navigen_bringup real.launch.py mock_hardware:=true
ros2 topic pub -r 10 /cmd_vel_nav geometry_msgs/msg/Twist '{linear: {x: 0.2}}'
ros2 topic echo /motor/telemetry
```

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

## Bag replay debugging

```bash
./scripts/record_bag.sh my_run          # on the UGV
ros2 bag play rosbags/my_run --clock    # on any dev machine, with RViz
```

## Per-phase exit criteria

Every phase ends with: `colcon build` clean → `colcon test` green → documented commands →
logically separated commits.
