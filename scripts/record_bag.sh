#!/usr/bin/env bash
# Record all topics needed to replay and debug a run without the UGV.
# Usage: ./scripts/record_bag.sh [name]
set -e
NAME=${1:-run_$(date +%Y%m%d_%H%M%S)}
mkdir -p rosbags
exec ros2 bag record -o "rosbags/${NAME}" \
  /camera/image_raw /camera/camera_info \
  /camera/left/image_raw /camera/right/image_raw /camera/depth \
  /imu/data /wheel/odom /visual_odom /odometry/filtered \
  /traversability/mask /traversability/debug_image /local_traversability_map \
  /cmd_vel /cmd_vel_nav /safety/state /safety/e_stop \
  /motor/telemetry /battery /ultrasonic/front_left /ultrasonic/front_right \
  /slam/tracking_state /plan /goal_pose /diagnostics /tf /tf_static
