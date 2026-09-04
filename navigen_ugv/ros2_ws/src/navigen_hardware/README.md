# navigen_hardware

Owns differential-drive Twist conversion, velocity/acceleration limiting, versioned CRC serial
framing, reconnecting NodeMCU ESP8266 transport, an encoderless protocol mock, and
telemetry/diagnostics.

The bridge subscribes to `/cmd_vel` and `/safety/e_stop`. It publishes `/motor/telemetry`,
`/battery`, both legacy ultrasonic range topics, and `/diagnostics`. The available hardware has no
encoders, so the bridge does **not** publish `/wheel/odom`; measured wheel velocities/ticks remain
zero and telemetry explicitly reports `open_loop_mode=true`, `wheel_feedback_valid=false`.

```bash
ros2 launch navigen_hardware motor_controller_bridge.launch.py mock_hardware:=true
ros2 topic pub --once /safety/e_stop std_msgs/msg/Bool '{data: false}'

ros2 launch navigen_hardware motor_controller_bridge.launch.py \
  serial_port:=/dev/serial/by-id/<YOUR_NODEMCU> baud_rate:=115200
```

All bridge tuning is in `config/hardware.yaml`. Stale or NaN/Inf commands and software e-stop
bypass the acceleration ramp and command zero immediately. Launch defaults to software e-stop
asserted; release it only during the lifted-wheel procedure. Shutdown sends zero and asserts
e-stop. Mock mode tests the command/safety contract but intentionally does not invent robot motion.
