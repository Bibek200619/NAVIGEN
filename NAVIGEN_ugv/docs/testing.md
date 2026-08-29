# Testing

## Unit tests (no hardware required)

```bash
cd ros2_ws
colcon build --symlink-install
colcon test --packages-select navigen_hardware navigen_safety navigen_perception
colcon test-result --verbose
```

Covered: Twist→wheel conversion, wheel limits/scaling, encoder ticks→velocity, serial frame
encode/decode round-trip, corrupted/partial packet rejection, NaN/Inf command rejection,
staleness detection, ultrasonic debounce filter, segmentation backend contract.

## Mock hardware mode

The whole workspace runs without any hardware:

```bash
ros2 launch navigen_bringup real.launch.py mock_hardware:=true
ros2 topic pub -r 10 /cmd_vel_nav geometry_msgs/msg/Twist '{linear: {x: 0.2}}'
ros2 topic echo /motor/telemetry
```

## Simulation smoke test (after every phase)

```bash
ros2 launch navigen_bringup sim.launch.py
./scripts/teleop.sh    # drive around, verify /wheel/odom, /imu/data, /camera/image_raw, TF
```

## Bag replay debugging

```bash
./scripts/record_bag.sh my_run          # on the UGV
ros2 bag play rosbags/my_run --clock    # on any dev machine, with RViz
```

## Per-phase exit criteria

Every phase ends with: `colcon build` clean → `colcon test` green → documented commands →
logically separated commits.
