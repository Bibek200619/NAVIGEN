# Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `xacro` fails on vehicle.yaml | Rebuild + `source install/setup.bash`; YAML syntax error in vehicle.yaml |
| Robot spawns but doesn't move in Gazebo | Bridge not running or `/cmd_vel` not bridged: `ros2 topic info /cmd_vel`, check `gz topic -l` |
| No camera image in RViz | Sensors system plugin missing in world; wrong render engine on the Pi (use `ogre2`); check `gz topic -e -t /camera/image_raw` |
| TF errors `odom → base_link missing` | In sim: DiffDrive `tf_topic` bridge entry; on real robot: EKF not running (Phase 6) |
| Serial permission denied | `sudo usermod -aG dialout $USER` and re-login |
| ESP32 telemetry garbage | Baud mismatch; check CRC error counter in bridge log |
| Motors stop every ~300 ms | Watchdog: command rate too low — bridge must send ≥ 20 Hz |
| Robot drives but odometry drifts badly | Encoder `ticks_per_revolution` / `track_width` wrong — redo encoder calibration |
| EKF output jumps | Two sources publishing odom TF (gz plugin + EKF) — disable one |
| SLAM stuck INITIALIZING | Not enough texture/parallax; move slowly with rotation; check camera calibration |
| Safety supervisor always e-stopped | `ros2 topic echo /safety/state` — `active_triggers` names the exact cause |
| Pi 5 overheating / low FPS | Add cooling; lower inference resolution in perception.yaml (default 320x240) |
