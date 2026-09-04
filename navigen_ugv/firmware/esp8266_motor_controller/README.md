# NodeMCU ESP8266 Motor Controller Firmware

PlatformIO/Arduino firmware for the team's photographed NodeMCU 1.0 (`ESP-12E` / `ESP8266MOD`),
one L298N, four encoderless TT motors, one HC-SR04, and one physical motor-power switch. Both left
motors share L298N channel A and both right motors share channel B.

This is an explicitly **open-loop** profile. It converts left/right wheel-surface targets to PWM;
it does not claim measured wheel speed, encoder ticks, PID regulation, or wheel odometry. The
Raspberry Pi must obtain real-robot localization from camera + MPU6050 visual-inertial odometry.

The controller still provides CRC-protected serial commands and telemetry, acceleration-limited
setpoints from the Pi, a 300 ms command watchdog, physical stop feedback, software e-stop, one
ultrasonic measurement, and invalid-configuration lockout.

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
| D0 | 16 | Motor-power/e-stop feedback, active LOW |

Keep the L298N **ENA and ENB jumpers installed**. PWM is applied to one direction input at a time,
which saves two GPIOs. D8/GPIO15 is a boot-strap pin; connect it only to the HC-SR04's
high-impedance TRIG input and do not add a pull-up. D7 receives ECHO only through a divider.

The MPU6050 belongs on the Raspberry Pi I2C bus, not this pin-limited ESP8266. Keep both SG90
servos disconnected and the camera mount mechanically fixed during SLAM. The relay module is not
used as the sole e-stop.

## Confirmed motor specification and active power gate

The team's Blessaro product listing specifies 3-6 V DC, 200 RPM dual-shaft BO motors (1:48), with
208 RPM no-load speed at 5 V and 170 mA load current per motor at 4.5 V. Stall current is not
specified. The photographed three-cell 18650 holder must therefore **not** feed the L298N motor
supply directly: a 3S lithium-ion stack can reach 12.6 V.

The user has excluded both the relay and buck converter. The relay is not required, but this means
the 3S holder is also excluded: use a measured 3-6 V motor battery instead. Power the Raspberry Pi
separately through a regulated USB-C source. Verify the combined stall-current margin for the two
motors on each L298N channel; firmware PWM is not a substitute for voltage regulation. Keep
`HARDWARE_CONFIGURATION_CONFIRMED=0` until the motor source, switch, and L298N logic-power
arrangement have been measured and peer-reviewed.

## Physical stop with the available switch

Put the suitably current-rated physical switch in series with the L298N **motor supply**, so it
cuts propulsion without software. D0 must also become LOW when that supply is cut. This can be
done with an auxiliary contact, or by sensing the switched motor rail through a divider calculated
for the measured maximum battery voltage. Never connect the battery rail directly to D0.

If the switch, holder, cells, wiring, or connector is not rated for the measured two-side stall
current, do not power the chassis. A relay controlled only by the ESP8266 is not an independent
emergency stop.

## Configure before arming

The repository builds safely with `HARDWARE_CONFIGURATION_CONFIRMED=0`, which leaves propulsion
disabled. Before changing it to `1`:

1. Verify every connection against the NodeMCU board labels and L298N terminal labels.
2. With no buck converter, use a measured 3-6 V motor battery and exclude the three-cell 18650
   holder. Verify motor side-pair stall current and switch/L298N/wiring ratings.
3. Verify the HC-SR04 ECHO divider and D0 feedback divider with a multimeter.
4. Measure wheel diameter and effective track width; copy them to the ROS YAML.
5. Keep initial ROS limits at or below 0.15 m/s linear and 0.50 rad/s angular.
6. Put the chassis on rigid stands and keep the physical switch open while connecting power.

Tune `MIN_EFFECTIVE_PWM` only after both motor directions and all stop paths pass. It compensates
for motor deadband; it is not feedback control and cannot make unequal motors track accurately.

## Build and flash

```bash
pip install platformio
../../scripts/validate_firmware.sh
pio run -e nodemcuv2 -t upload
pio device monitor -b 115200   # never while the ROS bridge owns the port
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
   must stop. Restoring motor power must be followed by an explicit software-e-stop release.
7. Unplug USB while moving slowly; propulsion must stop within approximately 300 ms.

Any unexpected movement, reset, hot driver/wire, failed stop, or invalid telemetry is a red gate.
Disconnect battery power, correct the issue, and restart from step 1.
