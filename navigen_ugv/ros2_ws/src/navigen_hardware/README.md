# navigen_hardware

Owns differential-drive conversion, acceleration/velocity limiting, versioned serial framing,
reconnecting ESP32 transport, protocol-level mock hardware, encoder wheel odometry, and hardware
telemetry/diagnostics. The bridge subscribes to `/cmd_vel` and `/safety/e_stop`, and publishes
`/motor/telemetry`, `/wheel/odom`, `/battery`, both ultrasonic ranges, and `/diagnostics`.

```bash
ros2 launch navigen_hardware esp32_bridge.launch.py mock_hardware:=true
ros2 topic pub --once /safety/e_stop std_msgs/msg/Bool '{data: false}'
ros2 launch navigen_hardware esp32_bridge.launch.py \
  serial_port:=/dev/ttyUSB0 baud_rate:=115200
```

All tuning lives in `config/hardware.yaml`. Real mode deliberately fails fast until
`ticks_per_revolution` is calibrated. Stale, NaN/Inf, and software e-stop conditions bypass the
acceleration ramp and command zero immediately. Launch defaults to software e-stop asserted;
publish `false` only after checking the platform is safe. Shutdown sends zero and asserts e-stop.
