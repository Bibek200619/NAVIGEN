#!/usr/bin/env bash
# Keyboard teleoperation on /cmd_vel. The hardware bridge enforces the configured
# speed/acceleration limits and stops on stale input. Phase 10 will remap this input
# through the safety supervisor before it reaches the bridge.
exec ros2 run teleop_twist_keyboard teleop_twist_keyboard "$@"
