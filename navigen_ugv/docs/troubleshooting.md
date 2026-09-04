# Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| `xacro` fails on vehicle.yaml | Rebuild + `source install/setup.bash`; YAML syntax error in vehicle.yaml |
| Robot spawns but doesn't move in Gazebo | Bridge not running or `/cmd_vel` not bridged: `ros2 topic info /cmd_vel`, check `gz topic -l` |
| No camera image in RViz | Sensors system plugin missing in world; wrong render engine on the Pi (use `ogre2`); check `gz topic -e -t /camera/image_raw` |
| Headless Gazebo cannot initialize rendering | Add `headless:=true software_rendering:=true rviz:=false`; verify Mesa/EGL packages are installed |
| Custom world loads but robot does not spawn | Set `world_name:=<name-inside-sdf>` as well as `world:=/absolute/path/world.sdf` |
| TF errors `odom → base_link missing` | In sim: check the DiffDrive `tf_topic` bridge entry; on real hardware: EKF is not running (Phase 6) |
| Nav2 goal tool says server unavailable | Wait for lifecycle activation; inspect `ros2 lifecycle get /bt_navigator` and map/controller/planner logs |
| Nav2 reports start or goal occupied | Confirm the selected goal is inside `navigen_outdoor.yaml`; view `/global_costmap/costmap` and avoid black/inflated cells |
| Nav2 has `map → odom` TF conflicts | Phase 3 bootstrap and localization are both running; relaunch with `publish_map_to_odom:=false` when SLAM owns the transform |
| Nav2 runs but simulation does not advance | Verify `/clock` is live and every Nav2 node has `use_sim_time:=true` |
| Serial permission denied | `sudo usermod -aG dialout $USER` and re-login |
| Real/mock launch is healthy but commands remain zero | This is the intended startup interlock. Verify the wheels are safe, then run `./scripts/estop.sh release --confirm`; inspect `estop_active` in telemetry. |
| Software e-stop release has no effect | The physical e-stop may still be active, firmware configuration may be invalid, or the one-shot publisher ran before launch. Check `/motor/telemetry` and `/diagnostics`, then retry only after resolving the reported state. |
| NodeMCU serial repeatedly disconnects | Check `/diagnostics`, USB power/cable, `/dev/ttyUSB*`, dialout membership, baud, and whether another process owns the port. Use a stable `/dev/serial/by-id/...` path. |
| NodeMCU telemetry rejected | Firmware and bridge must both use protocol version 2 and 115200 baud; inspect CRC/version counters in `/diagnostics` and `/motor/telemetry`. |
| Firmware says configuration invalid | Verify the checked-in NodeMCU map, divider voltages, stop circuit, and limits; set `HARDWARE_CONFIGURATION_CONFIRMED=1` only after review, rebuild, and flash. |
| Motors stop every ~300 ms | Firmware watchdog detected lost valid velocity packets; verify bridge connection and configured command rate ≥20 Hz |
| NodeMCU device changes after reboot | Launch with the stable `/dev/serial/by-id/<device>` symlink instead of `/dev/ttyUSB0`. |
| Motor direction is wrong | Set the corresponding `MOTOR_*_INVERTED`; if two motors on one shared side disagree, reverse one motor's physical leads. |
| Robot curves under a straight command | This is expected with encoderless open-loop drive. Reduce the faster side's `*_PWM_SCALE`; VIO must close the real navigation loop. |
| `/wheel/odom` is absent in real/mock mode | Expected: the motors have no encoders and the bridge refuses to fabricate odometry. Gazebo still provides `/wheel/odom`; real pose arrives later from VIO/EKF. |
| Right ultrasonic is NaN | Expected in the one-sensor NodeMCU profile; the centered sensor is carried on `/ultrasonic/front_left`. |
| NodeMCU will not boot after wiring | Disconnect peripherals, then check D8/GPIO15 is not pulled HIGH. It is a boot-strap pin and is reserved only for HC-SR04 TRIG. |
| Battery topic reports 0 V | Expected until A0 input scaling and a safe battery divider are measured and `BATTERY_MONITOR_ENABLED` is enabled. |
| EKF output jumps | Two sources publishing odom TF (gz plugin + EKF) — disable one |
| SLAM stuck INITIALIZING | Not enough texture/parallax; move slowly with rotation; check camera calibration |
| Safety supervisor always e-stopped | `ros2 topic echo /safety/state` — `active_triggers` names the exact cause |
| Pi 5 overheating / low FPS | Add cooling; lower inference resolution in perception.yaml (default 320x240) |
