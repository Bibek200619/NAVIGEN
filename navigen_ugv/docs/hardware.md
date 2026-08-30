# Hardware

## Bill of materials

- Raspberry Pi 5, Ubuntu 24.04, ROS 2 Jazzy (active cooling recommended)
- ESP32 DevKit (dual-core, 3.3 V logic) — USB serial to the Pi
- 4WD skid-steer chassis; left-front + left-rear motors driven as LEFT side, right pair as RIGHT side
- 4 DC geared motors with quadrature encoders
- 2 dual H-bridge motor drivers (four independently wired motor channels commanded in side pairs)
- Stereo camera (preferred) or monocular USB/Pi camera
- MPU6050 IMU, 2x HC-SR04 front ultrasonics (5 V — use a voltage divider on ECHO to the ESP32)
- Physical e-stop switch: MUST cut motor power directly AND feed a digital input to the ESP32
- Battery with voltage sensing (divider to an ESP32 ADC pin)

## Responsibility split

| Function | Owner |
|---|---|
| Encoder counting, wheel PID @100 Hz, PWM/DIR, ultrasonic timing, watchdog, e-stop | ESP32 |
| Camera, perception, SLAM, EKF, Nav2, safety supervisor, serial bridge | Raspberry Pi |

## Pin configuration

NO GPIO is hard-coded. Fill `firmware/esp32_motor_controller/include/board_config.h`. Each of LF,
LR, RF, and RR needs PWM/DIR-A/DIR-B plus motor inversion. Supply at least one complete encoder
pair per side; a second per side is optional. Also fill both ultrasonic pairs, physical e-stop
feedback, battery ADC/divider, decoded `TICKS_PER_REV`, geometry, max wheel speed, independent
side PID gains, and PWM settings. Required values left at `-1`/`0.0`, duplicate pins, or incomplete
encoder pairs leave the controller unarmed and set `configuration_valid=false` in telemetry.

Electrical constraints:

- Join Pi, ESP32, sensor, and motor-driver signal grounds, but power motors from their rated supply.
- Never connect 5 V HC-SR04 ECHO directly to a 3.3 V ESP32 input; use a divider/level shifter.
- The physical e-stop must interrupt driver/motor power independently of firmware. Its GPIO is
  feedback, not the sole stopping mechanism.
- Verify that chosen GPIOs support output/ADC/interrupt use on your exact ESP32 board and avoid
  unsafe boot-strapping states. The repository cannot infer your board or wiring.
- Add motor suppression, a correctly rated fuse, and driver cooling. Test initially with wheels up.

## Serial protocol (Pi ⇄ ESP32)

Little-endian binary frame:

`AA 55 | version:u8 | msg_id:u8 | sequence:u16 | payload_len:u8 | payload | crc8`

Version is `1`; payload length is bounded to 64 bytes. CRC-8/ATM uses polynomial `0x07`, initial
value `0x00`, and covers `version` through the end of payload (not the sync bytes or CRC). Invalid
version, length, CRC, and payload shape are rejected. Duplicate/out-of-order commands are rejected
during a live session; after watchdog expiry the next valid command establishes a new sequence
baseline so either endpoint can reboot. An asserted e-stop is accepted regardless of sequence.

- `0x01` CMD_VELOCITY (Pi→ESP32): int16 left mm/s, int16 right mm/s @ 20-50 Hz
- `0x02` CMD_ESTOP (Pi→ESP32): uint8 active
- `0x10` TELEMETRY (ESP32→Pi, 20-50 Hz): int16 measured velocities in mm/s, int16 PWM,
  int32 cumulative side ticks, uint16 battery mV, uint16 ultrasonic mm (`0xFFFF` invalid), flags,
  acknowledged command sequence, command age in ms, and firmware CRC reject count. Flag bits are
  bit 0 e-stop, bit 1 watchdog, and bit 2 invalid/unarmed configuration.

Reference implementations are `include/navigen_protocol.hpp` in firmware and
`ros2_ws/src/navigen_hardware/navigen_hardware/serial_protocol.py` on the Pi. Their shared golden
vector for sequence `0x1234`, left `+0.250 m/s`, right `-0.250 m/s` is
`aa550101341204fa0006ff3c`.

Watchdog: no valid `CMD_VELOCITY` for 300 ms → zero PWM and driver disable. E-stop always overrides
commands. The Pi bridge sends zero commands when upstream `/cmd_vel` is stale, so firmware watchdog
means Pi/USB/protocol communication was actually lost.

## Raspberry Pi bridge

Set geometry, encoder calibration, limits, timeouts, and serial settings in
`ros2_ws/src/navigen_hardware/config/hardware.yaml`. Real mode refuses to start while
`ticks_per_revolution` is zero. Hardware-free mode uses the same packet encoder/parser:

```bash
ros2 launch navigen_hardware esp32_bridge.launch.py mock_hardware:=true
ros2 topic pub -r 20 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.2}}'
ros2 topic echo /motor/telemetry
ros2 topic echo /wheel/odom
ros2 topic echo /diagnostics
ros2 topic pub --once /safety/e_stop std_msgs/msg/Bool '{data: true}'
```

Published outputs are `/motor/telemetry`, `/wheel/odom`, `/battery`, both front ultrasonic `Range`
topics, and `/diagnostics`. Do not run `pio device monitor` while the bridge owns the serial port.
