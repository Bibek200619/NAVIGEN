# Hardware

## Bill of materials

- Raspberry Pi 5, Ubuntu 24.04, ROS 2 Jazzy (active cooling recommended)
- ESP32 DevKit (dual-core, 3.3 V logic) — USB serial to the Pi
- 4WD skid-steer chassis; left-front + left-rear motors driven as LEFT side, right pair as RIGHT side
- 4 DC geared motors with quadrature encoders
- Motor power stage with at least two H-bridge channels. The current team profile uses one L298N:
  its channel A drives the left motor pair and channel B drives the right motor pair.
- Stereo camera (preferred) or monocular USB/Pi camera
- MPU6050 IMU, 2x HC-SR04 front ultrasonics (5 V — use a voltage divider on ECHO to the ESP32)
- Physical e-stop switch: MUST cut motor power directly AND feed a digital input to the ESP32
- Battery with voltage sensing (divider to an ESP32 ADC pin)

## Current team hardware profile and gaps

The 2026-09-04 photo audit confirms a single L298N, four yellow TT gear motors, a three-cell 18650
holder, an MPU6050 breakout, one HC-SR04, one SG90, a 5 V relay module, a breadboard, and resistors.
The Raspberry Pi 5, Raspberry Pi Camera, buck converter, second ultrasonic, and pan-tilt mount were
reported but were not identifiable in the supplied photographs.

The photographed controller is a **NodeMCU ESP8266**, identified by `ESP8266MOD` on its radio
module and its D0-D8 board labels. It is not an ESP32 DevKit and is not supported by this firmware.
Do not select an ESP8266 PlatformIO target or try to fill the ESP32 pin map for this board. Obtain a
real ESP32 development board compatible with PlatformIO's `esp32dev` target, then photograph both
the module marking and GPIO labels before assigning pins.

The intended profile remains supported as **monocular camera + two side motor channels**, subject
to these unresolved physical gates:

- The photographed TT motors have only their two power leads visible and no fitted encoder
  hardware. Install a real quadrature A/B encoder on at least one output shaft per side, or replace
  them with encoder-equipped gear motors. A single pulse/tachometer output is insufficient for
  direction-aware odometry. Do not bypass the firmware's encoder requirement or tune closed-loop
  PID without feedback.
- The MPU6050 is present, but its exact wiring, mounting orientation, calibration, and ROS driver
  are Phase 6 work. Mount it rigidly to the chassis; do not leave it on a breadboard during motion.
- Add a physical, latching emergency-stop circuit that interrupts motor power and provides ESP32
  feedback. The photographed 5 V relay module is not an emergency-stop switch and must not be the
  sole stopping path, especially when controlled by the same microcontroller as propulsion.
- Add resistor dividers/level shifters for every 5 V HC-SR04 ECHO line and the correctly calculated
  battery ADC divider. The photographed resistor bands are not clear enough to verify their
  values; measure them with a multimeter before use. Add a suitably rated fuse and power wiring;
  breadboards are signal-only.
- The photo confirms three 18650 slots but not their electrical series/parallel arrangement,
  protection/BMS, installed cell condition, or output voltage. Record and measure those values,
  the motor voltage rating, and the buck converter's continuous current rating before inserting
  cells or applying motor power.
- Check the sum of the two motors' stall currents on each side against the real L298N module's
  channel and thermal limits. Replace the driver if it is undersized; do not solve overheating by
  lowering a software limit alone.
- Provide a clear top-down photograph of the L298N labels and all ENA/ENB/5V-enable jumpers before
  final wiring review. The current angled image is sufficient to identify the board but not every
  jumper state or terminal assignment.

The two SG90 servos are not part of Phase 5 propulsion. Keep the camera centered and mechanically
fixed during autonomous navigation. Moving a monocular SLAM camera while publishing a static
`base_link -> camera_link` transform corrupts the pose estimate. Pan/tilt may be added later only
with calibrated joint states and a dynamic TF chain; SG90 command angle alone is not reliable pose
feedback.

## Responsibility split

| Function | Owner |
|---|---|
| Encoder counting, wheel PID @100 Hz, PWM/DIR, ultrasonic timing, watchdog, e-stop | ESP32 |
| Camera, perception, SLAM, EKF, Nav2, safety supervisor, serial bridge | Raspberry Pi |

## Pin configuration

NO GPIO is hard-coded. Fill `firmware/esp32_motor_controller/include/board_config.h`. For the team
L298N keep `MOTOR_OUTPUT_CHANNEL_COUNT=2`: LEFT PWM/DIR-A/DIR-B map to ENA/IN1/IN2 and RIGHT maps
to ENB/IN3/IN4. The optional four-channel layout remains available for a future driver upgrade.
Supply at least one complete encoder pair per side; a second per side is optional. Also fill both
ultrasonic pairs, physical e-stop feedback, battery ADC/divider, decoded `TICKS_PER_REV`, geometry,
max wheel speed, independent side PID gains, and PWM settings. Required values left at `-1`/`0.0`,
duplicate pins, or incomplete encoder pairs leave the controller unarmed and set
`configuration_valid=false` in telemetry.

Electrical constraints:

- Join Pi, ESP32, sensor, and motor-driver signal grounds, but power motors from their rated supply.
- Remove the L298N ENA/ENB jumpers when those pins are driven by ESP32 PWM. Wire both left motors
  in parallel to channel A and both right motors in parallel to channel B. Reverse an individual
  motor's leads if motors sharing one channel do not turn the same vehicle direction.
- Never route motor or servo current through the breadboard, Pi, or ESP32 regulator. Size the 5 V
  buck converter for the Pi and any separately powered servos, with appropriate grounding and
  noise suppression.
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
ros2 launch navigen_bringup real.launch.py mock_hardware:=true rviz:=false
./scripts/estop.sh release --confirm
ros2 topic pub -r 20 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.2}}'
ros2 topic echo /motor/telemetry
ros2 topic echo /wheel/odom
ros2 topic echo /diagnostics
./scripts/estop.sh engage
```

Published outputs are `/motor/telemetry`, `/wheel/odom`, `/battery`, both front ultrasonic `Range`
topics, and `/diagnostics`. Do not run `pio device monitor` while the bridge owns the serial port.

## First physical teleoperation gate

Do not perform this gate alone. One person operates commands while another remains beside the
physical e-stop. Keep the chassis securely on stands with every wheel clear of the floor.

Preparation:

1. Confirm the L298N current/thermal margin, encoders, hardwired e-stop, protected battery pack,
   voltage dividers, and buck-converter rating. Then fill and peer-review `board_config.h`; the
   checked-in `-1`/`0.0` defaults deliberately keep propulsion invalid. Keep motor power
   disconnected and flash only after
   `./scripts/validate_firmware.sh` passes.
2. Enter measured `ticks_per_revolution`, wheel radius, track width, speed/acceleration limits,
   and serial settings in `navigen_hardware/config/hardware.yaml`. Keep first-test limits at or
   below 0.10 m/s linear and 0.30 rad/s angular.
3. Keep the matching geometry in `navigen_description/config/vehicle.yaml`; do not copy the
   simulation defaults as measurements.
4. On the Pi, add the operator to `dialout`, re-login, and identify the stable ESP32 path with
   `ls -l /dev/serial/by-id/`. Never depend on a changing `/dev/ttyUSB0` name for the demo.

Lifted-wheel sequence:

1. Engage the physical e-stop, disconnect motor power, and connect ESP32 USB.
2. Launch `real.launch.py` with the stable serial path. Do not release software e-stop yet.
3. Confirm `/motor/telemetry` reports `serial_connected=true`, `configuration_valid=true`, zero
   wheel velocities, and `estop_active=true`; confirm `/diagnostics` has no transport error.
4. Apply motor power while the physical e-stop remains engaged. Verify no wheel moves.
5. Release the physical e-stop; software e-stop must still prevent motion.
6. Run `./scripts/estop.sh release --confirm`, then `./scripts/teleop.sh`. Command each side and
   direction briefly. Verify wheel direction, encoder tick sign, measured velocity, and odometry.
7. While moving slowly, run `./scripts/estop.sh engage`; both sides must stop immediately. Repeat
   with the physical e-stop. Releasing the physical switch must not resume motion: the bridge
   latches the event and requires a fresh `release --confirm`.
8. Re-release both stops, move slowly, then unplug USB. Both sides must stop within the configured
   300 ms watchdog interval. Reconnect must not cause motion without a fresh command.
9. Stop teleop, engage both stops, remove motor power, and save telemetry/diagnostic evidence.

Any unexpected motion, wrong encoder sign, serial loss, stale telemetry, or failed stop is a red
gate. Cut motor power, correct configuration/wiring, and repeat from step 1. Ground testing is not
allowed until every lifted-wheel check is green.
