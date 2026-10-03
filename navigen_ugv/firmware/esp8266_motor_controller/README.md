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
| D3 | 0 | Unused; MPU SDA is on Pi header pin 3 |
| D4 | 2 | Unused; MPU SCL is on Pi header pin 5 |

Keep the L298N **ENA and ENB jumpers installed**. PWM is applied to one direction input at a time,
which saves two GPIOs. D8/GPIO15 is a boot-strap pin; connect it only to the HC-SR04's
high-impedance TRIG input and do not add a pull-up. D7 receives ECHO only through a divider.
D3/GPIO0 and D4/GPIO2 are boot-strap pins that must remain high during boot.
The installed MPU is wired to the Pi at address `0x68`; the Pi dashboard reads
it with `--imu-on-pi`. The optional ESP8266 I2C reader is disabled in
`include/board_config.h`. Keep all MPU power and I2C pullups at 3.3 V.
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

On 2026-09-30, the measured voltage at the L298N motor-supply terminal with the switch on was
**12.6 V** from three 18650 cells in series (3S), wired directly to the driver. On 2026-10-03,
the owner remeasured about **12 V** at the same terminal with no regulator, reported about
**3 V** at each motor, and confirmed **3.6 V is the maximum motor voltage**. Earlier photos
were described as showing a **3–6 V** marking; the firmware uses the owner's confirmed
**3.6 V maximum**. Each motor is reported to stall at
about 0.8–1 A. Two motors share each L298N channel, so the stated stall currents sum to about
**1.6–2 A per channel**, before
allowing for measurement uncertainty or driver heating. **The current direct motor supply is
unsuitable for an unattended or ground-driving product. Keep the motor switch open and
`HARDWARE_CONFIGURATION_CONFIRMED=0`.** The L298N's voltage drop and PWM do not regulate a
12.6 V supply down to a guaranteed safe motor voltage.

As requested, firmware now caps each motor output at **127/255 (49.8% duty)**, including the
bench-test path. The PWM hardware range remains 255; changing the range to 127 would still
allow 100% duty. A 50% duty cycle changes the **average** applied voltage, but not the voltage
of each on-pulse. The theoretical 12.6 V × 50% = 6.3 V is already above the conservative
3.6 V limit before considering the L298N's variable drop, motor current ripple, or a stalled
wheel. A multimeter reading of 3 V while PWM is active can reflect an average; it does not
establish the voltage of each energized pulse.
[Microchip's brushed-motor note](https://ww1.microchip.com/downloads/en/appnotes/00905b.pdf)
explains the PWM average-voltage relationship; it does not make PWM a regulated supply.

The firmware also records the observed 12.6 V as `MOTOR_SUPPLY_MEASURED_MV`; setting
`HARDWARE_CONFIGURATION_CONFIRMED=1` without first updating this value for a measured safe
motor rail causes a build error. This static check is **not** a voltage sensor or substitute for
electrical measurement. The optional bench motor-test mode now honors the same configuration
lockout.

Before enabling propulsion, revise the motor power and driver design so the voltage delivered
to each motor stays within its verified rating, including energized pulses, across the battery's
full charge range. A 3.6 V supply directly into the L298N is not a simple solution: the
[L298 IC datasheet](https://www.st.com/resource/en/datasheet/cd00000240.pdf) specifies an
operating motor supply of at least the input-high voltage plus 2.5 V. A motor driver rated for
the intended low-voltage rail may be needed, and any driver change requires a review of this
firmware's pin map and switching behavior. Size the regulator, switch, wiring, battery, and
driver channels for the combined startup/stall current of the two motors on each channel. The
[L298 IC datasheet](https://www.st.com/resource/en/datasheet/l298.pdf) lists 2 A DC as an absolute
maximum **per channel**, not a promise that a particular module can
dissipate that load continuously. The reported 1.6–2 A pair stall current leaves essentially no
margin at that absolute limit. Confirm the L298N board's 5 V logic supply separately; its
onboard regulator/jumper behavior depends on the board. Power the Raspberry Pi separately
through a properly regulated USB-C source.

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
2. Replace the present direct 12 V L298N feed with a motor supply and driver that are compatible
   with the verified motor rating, then measure the driver rail and motor pulse voltage over the
   expected battery range. Recheck the battery-cell arrangement and verify motor side-pair stall
   current and component ratings. Update the driver pin profile if the driver changes, and set
   `MOTOR_SUPPLY_MEASURED_MV` to the highest verified motor-rail voltage.
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
