# NAVIGEN Architecture

## Design rules

1. Camera is the primary navigation sensor; GPS is forbidden as an input.
2. Mature ROS packages (Nav2, robot_localization, ORB-SLAM3) are wrapped by thin adapters so any component can be replaced.
3. Simulation and real hardware expose IDENTICAL ROS interfaces.
4. Safety commands always override navigation commands.

## Packages

| Package | Type | Responsibility |
|---|---|---|
| navigen_interfaces | ament_cmake | Custom msgs (MotorTelemetry, SafetyState, TrackingState) |
| navigen_description | ament_cmake | URDF/xacro, TF tree, RViz config, vehicle.yaml (single source of geometry) |
| navigen_bringup | ament_cmake | sim.launch.py / real.launch.py, gz bridge |
| navigen_hardware | ament_python | Kinematics, serial protocol, ESP32 bridge node (+mock) |
| navigen_perception | ament_python | SegmentationBackend abstraction, ONNX + mock backends, traversability node |
| navigen_localization | ament_cmake | robot_localization EKF config, ORB-SLAM3 adapter (Phase 8) |
| navigen_navigation | ament_cmake | Nav2 configuration, traversability costmap integration (Phases 3/9) |
| navigen_safety | ament_python | Safety supervisor, ultrasonic emergency filter |

## TF tree

```
map → odom → base_link
  base_link → base_footprint / base_chassis_link
  base_link → camera_link → camera_optical_frame
  base_link → imu_link
  base_link → ultrasonic_left_link / ultrasonic_right_link
  base_link → {front,rear}_{left,right}_wheel_link
```

- `odom → base_link`: Gazebo DiffDrive plugin in simulation, then robot_localization EKF on
  hardware (Phase 6+). Only one source may publish this transform at a time.
- `map → odom`: a documented identity bootstrap in Phase 3 simulation; ORB-SLAM3 visual
  localization owns it from Phase 8 onward. Never run both publishers together.
- All sensor transforms come from `navigen_description/config/vehicle.yaml` — never hard-coded.

## Topics

| Topic | Type | Producer |
|---|---|---|
| /camera/image_raw (+ /camera/left,right, /camera/depth) | sensor_msgs/Image | camera driver / gz |
| /imu/data | sensor_msgs/Imu | IMU driver / gz |
| /wheel/odom | nav_msgs/Odometry | ESP32 bridge / gz |
| /visual_odom | nav_msgs/Odometry | ORB-SLAM3 adapter |
| /odometry/filtered | nav_msgs/Odometry | EKF |
| /traversability/mask | sensor_msgs/Image (mono8 class ids) | perception |
| /traversability/debug_image | sensor_msgs/Image | perception |
| /local_traversability_map | nav_msgs/OccupancyGrid | perception→costmap (Phase 9) |
| /ultrasonic/front_left, /ultrasonic/front_right | sensor_msgs/Range | ESP32 bridge |
| /cmd_vel_nav | geometry_msgs/Twist | Nav2 / teleop (real mode) |
| /cmd_vel | geometry_msgs/Twist | safety supervisor (real) / teleop (sim) |
| /motor/telemetry | navigen_interfaces/MotorTelemetry | ESP32 bridge |
| /battery | sensor_msgs/BatteryState | ESP32 bridge |
| /safety/e_stop | std_msgs/Bool | operator / GUI |
| /safety/state | navigen_interfaces/SafetyState | safety supervisor |
| /slam/tracking_state | navigen_interfaces/TrackingState | ORB-SLAM3 adapter |

## Phase 2 simulation contract

`navigen_bringup/sim.launch.py` expands the same robot xacro used by real mode, starts Gazebo
Harmonic, spawns the model, starts `robot_state_publisher`, bridges simulation transport, and
optionally opens RViz. The bridge directions are deliberate: `/cmd_vel` flows ROS→Gazebo;
clock, wheel odometry, odometry TF, joint states, image, camera info, and IMU flow Gazebo→ROS.
The world uses only inline primitives so test and demo startup never depends on an internet
connection.

## Phase 3 navigation contract

`navigen_navigation/nav2_sim.launch.py` composes Phase 2 Gazebo with a minimal lifecycle-managed
Nav2 stack: map server, SmacPlanner2D, Regulated Pure Pursuit, recovery behaviors, and BT
navigator. The known map mirrors the primitive obstacles in `navigen_outdoor.sdf`; static and
inflation layers are used without laser data or fabricated vision messages. Nav2 consumes the
live Gazebo `/wheel/odom` and sends bounded `geometry_msgs/Twist` commands to `/cmd_vel`.

The identity `map → odom` transform is valid only because the Phase 3 robot spawns at the map
origin and Gazebo odometry starts there. It is an explicit temporary seam: Phase 8 disables it
and supplies visual localization, while Phase 9 adds camera-derived traversability costs.

Class ids in `/traversability/mask`: 0=UNKNOWN, 1=TRAVERSABLE, 2=NON_TRAVERSABLE, 3=OBSTACLE.

## Command chain (real mode)

Nav2/teleop → `/cmd_vel_nav` → **safety supervisor** (e-stop, staleness, NaN, ultrasonic, SLAM-lost checks; speed cap 0.4 m/s) → `/cmd_vel` → ESP32 bridge (Twist → left/right wheel velocity) → serial → ESP32 PID (100 Hz) → motors. The ESP32 additionally enforces a 300 ms command watchdog and the hardware e-stop. Phase 3 simulation connects Nav2 directly to `/cmd_vel`; the safety arbitration chain is inserted in Phase 10.
