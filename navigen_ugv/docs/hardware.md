# Hardware

## Bill of materials

- Raspberry Pi 5, Ubuntu 24.04, ROS 2 Jazzy (active cooling recommended)
- ESP32 DevKit (dual-core, 3.3 V logic) — USB serial to the Pi
- 4WD skid-steer chassis; left-front + left-rear motors driven as LEFT side, right pair as RIGHT side
- 4 DC geared motors with quadrature encoders
- 2 dual H-bridge motor drivers (one per side, or one channel per wheel pair)
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

NO pin is hard-coded. Fill `firmware/esp32_motor_controller/include/board_config.h`:
motor PWM/DIR pins (per side), encoder A/B pins (per side or per wheel), ultrasonic TRIG/ECHO,
e-stop input, battery ADC pin, PID gains, `TICKS_PER_REV`, `WHEEL_RADIUS_M`, `TRACK_WIDTH_M`,
`MAX_PWM`, serial baud. Values marked `-1` mean "not configured" and the firmware must refuse to arm.

## Serial protocol (Pi ⇄ ESP32)

Framed binary, `0xAA 0x55 | msg_id | len | payload | crc8(poly 0x07)`.

- `0x01` CMD_VELOCITY (Pi→ESP32): int16 left mm/s, int16 right mm/s @ 20-50 Hz
- `0x02` CMD_ESTOP (Pi→ESP32): uint8 active
- `0x10` TELEMETRY (ESP32→Pi, 20-50 Hz): left/right velocity (mm/s), left/right PWM,
  left/right ticks (int32), battery mV, ultrasonic left/right mm (0xFFFF=invalid), flags
  (bit0 e-stop, bit1 watchdog)

Phase 4 adds the reference implementation at
`ros2_ws/src/navigen_hardware/navigen_hardware/serial_protocol.py`.
Watchdog: no valid CMD_VELOCITY for ~300 ms (configurable) → both sides to zero, propulsion disabled.
