# NodeMCU ESP8266 Motor Controller Firmware

PlatformIO/Arduino firmware for the team's photographed NodeMCU 1.0 (`ESP-12E` / `ESP8266MOD`),
one L298N, four encoderless TT motors, one HC-SR04, and one physical motor-power switch. Both left
motors share L298N channel A and both right motors share channel B.

This is an explicitly **open-loop** profile. It converts left/right wheel-surface targets to PWM;
it does not claim measured wheel speed, encoder ticks, PID regulation, or wheel odometry. The
deployed product is camera-assisted manual driving; it has no localization requirement or IMU.

The controller still provides CRC-protected serial commands and telemetry, acceleration-limited
setpoints from the Pi, a 300 ms command watchdog, software e-stop, one
ultrasonic measurement, a local reverse/pivot obstacle stop, configurable proximity beeping, and
invalid-configuration lockout.

## Fixed team pin profile

`include/board_config.h` is the only pin/configuration source. The checked-in map is:

| NodeMCU | GPIO | Connection |
|---|---:|---|
| D1 | 5 | L298N IN1 (left forward PWM) |
| D2 | 4 | L298N IN2 (left reverse PWM) |
| D5 | 14 | L298N IN3 (right forward PWM) |
| D6 | 12 | L298N IN4 (right reverse PWM) |
| D8 | 15 | HC-SR04 TRIG |
| D7 | 13 | HC-SR04 ECHO through a verified 5 V→3.3 V divider |
| D0 | 16 | Active buzzer control (off by default; Pi dashboard configurable) |

Keep the L298N **ENA and ENB jumpers installed**. PWM is applied to one direction input at a time,
which saves two GPIOs. D8/GPIO15 is a boot-strap pin; connect it only to the HC-SR04's
high-impedance TRIG input and do not add a pull-up. D7 receives ECHO only through a divider.
The rear sensor blocks reverse and pivot commands at or inside 30 cm, and also blocks reverse
when its reading is missing or stale. The Pi applies a larger 35 cm margin before sending a
reverse command. The Pi dashboard sends the buzzer enable setting and threshold to the ESP8266 over the framed
serial protocol. The default threshold is 30 cm; the buzzer defaults off until enabled in the
dashboard. It beeps intermittently only when the sensor has a fresh valid reading at or inside the
configured threshold, and stays silent beyond it or when the reading is invalid. Use an active
buzzer and a suitable transistor driver; do not power a high-current buzzer directly from the
ESP8266 GPIO. D0 cannot simultaneously be used for the optional e-stop feedback while the buzzer
is enabled. This vehicle currently has the buzzer connected directly to D0. Leave the buzzer
disabled until its rated operating voltage and input current are confirmed compatible with the
ESP8266 GPIO, or add the appropriate transistor driver.

## Motor power and active lockout

The present build uses four battery cells, but their series/parallel wiring, measured L298N
motor-supply voltage, exact motor voltage rating, and combined stall current have not been
recorded in this repository. **Keep motor power switched off and
`HARDWARE_CONFIGURATION_CONFIRMED=0` until those values and the L298N logic-power arrangement
are verified.** The L298N's voltage drop and PWM do not make an overvoltage battery safe for a
lower-voltage motor. Both motors on one side share one L298N output; verify the current capability
of each channel, wiring, connectors, switch, and battery under a stalled-wheel condition.
Power the Raspberry Pi separately through a properly regulated USB-C source.

## Physical stop with the available switch

Put the suitably current-rated physical switch in series with the L298N **motor supply**, so it
cuts propulsion without software. The current D0 buzzer connection means there is **no** motor
switch feedback in firmware (`ESTOP_INPUT_ENABLED=0`); opening the switch still cuts propulsion
electrically. Do not connect the battery rail to D0. If switch feedback is added later, use a
separate suitable GPIO or redesign the D0 circuit, then verify the input levels with a meter.
Because the controller cannot see this switch, closing it while a drive command is still active
could restart the motors. Engage software e-stop and release all drive controls before restoring
motor power; leave the switch open after an emergency until the cause is resolved.

If the switch, holder, cells, wiring, or connector is not rated for the measured two-side stall
current, do not power the chassis. A relay controlled only by the ESP8266 is not an independent
emergency stop.

## Configure before arming

The repository builds safely with `HARDWARE_CONFIGURATION_CONFIRMED=0`, which leaves propulsion
disabled. The current build also has `ESTOP_INPUT_ENABLED=0`, so D0 is used only for the buzzer.
Software e-stop, the command watchdog, and configuration lockout remain active. Before changing
the confirmation flag to `1`:

1. Verify every connection against the NodeMCU board labels and L298N terminal labels.
2. Record the battery-cell arrangement, voltage at the L298N motor-supply terminal with the
   switch on, and each motor's printed voltage rating. Verify that actual motor voltage and
   side-pair stall current stay within all component ratings.
3. Verify the HC-SR04 ECHO divider with a multimeter; keep
   `ESTOP_INPUT_ENABLED=0` while D0 is assigned to the buzzer.
4. Measure effective left/right track width and set the Pi runtime's `--track-width` value.
5. Keep the current Pi manual-drive limits at or below 0.15 m/s linear and 0.50 rad/s angular.
6. Put the chassis on rigid stands and keep the physical switch open while connecting power.

Tune `MIN_EFFECTIVE_PWM` only after both motor directions and all stop paths pass. It compensates
for motor deadband; it is not feedback control and cannot make unequal motors track accurately.

## Build and flash

```bash
pip install platformio
../../scripts/validate_firmware.sh
pio run -e nodemcuv2 -t upload
pio device monitor -b 115200   # never while the Pi dashboard owns the port
```

The target is pinned to `platformio/espressif8266@4.2.1`, board `nodemcuv2`, C++17. Automated
validation compiles but never flashes hardware.

## First lifted-wheel test

1. Keep all wheels clear, motor power switch open, and software e-stop asserted.
2. Flash the firmware and launch the Pi bridge. Telemetry must show
   `configuration_valid=true`, `open_loop_mode=true`, and `wheel_feedback_valid=false`.
3. Close motor power; software e-stop must still prevent motion.
4. Release software e-stop and command at most 0.05 m/s. Correct a side using only
   `MOTOR_LEFT_INVERTED` or `MOTOR_RIGHT_INVERTED`.
5. Verify forward, reverse, left turn, and right turn. The telemetry PWM sign must match each
   command; measured velocities and ticks must remain zero because no encoder exists.
6. While moving slowly, engage software e-stop, then repeat with the physical switch. Both sides
   must stop. Engage software e-stop and release the drive control before restoring motor power;
   the current wiring cannot detect switch restoration automatically.
7. Unplug USB while moving slowly; propulsion must stop within approximately 300 ms.
8. With wheels lifted, command reverse with the rear sensor disconnected and with a target within
   30 cm; both cases must stop propulsion at the ESP8266.

Any unexpected movement, reset, hot driver/wire, failed stop, or invalid telemetry is a red gate.
Disconnect battery power, correct the issue, and restart from step 1.
