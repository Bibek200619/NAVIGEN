#!/usr/bin/env bash
# Keyboard teleoperation on /cmd_vel (sim) — pass a remap for real mode:
#   ./scripts/teleop.sh --ros-args -r /cmd_vel:=/cmd_vel_nav
exec ros2 run teleop_twist_keyboard teleop_twist_keyboard "$@"
