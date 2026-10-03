# NAVIGEN manual-drive UGV: current Pi

The deployed Pi 5 runs the OV5647 Pi Camera, dashboard, and USB-connected
ESP8266. The ESP8266 reports one rear ultrasonic distance; it drives one L298N
for four motors only after the motor-power configuration is confirmed. There
are no wheel encoders, autonomous route planner, or front range sensor in this
vehicle. The Pi-connected motion module reports MPU-6500-compatible identity
`0x70` at I2C address `0x68` and displays live sensor tilt and turn rate, but cannot supply wheel
distance or absolute heading. The operator must watch the camera for forward
obstacles.

## Open and check the dashboard

1. Power the Pi from its regulated USB-C supply and connect the ESP8266 USB cable.
2. On a laptop on the same Wi-Fi, open `http://Hexcore.local:8080` (or
   `http://192.168.53.180:8080` if the hostname does not resolve).
3. Read the private session token with
   `ssh lenin@Hexcore.local 'cat ~/.config/navigen/dashboard.token'`.
   Paste it into the webpage and click **Connect**. Do not share or commit it.
4. Check that the live camera updates and **Rear distance** shows a fresh reading
   when a flat object is behind the sensor. A missing echo is shown as invalid,
   never as a clear path. The buzzer starts disabled, with a 30 cm threshold.
5. The supervised continuous image has no total drive window. The dashboard
   labels it `SUPERVISED DRIVE` and retains camera, e-stop, serial watchdog,
   and rear guard interlocks. Its 80/255 PWM cap does not regulate the 12 V
   rail down to the motor's stated 3.6 V maximum. Keep the physical switch
   within reach and directly watch the vehicle while driving.

For the MPU breakout wiring use Pi header **pin 1 → VCC (3.3 V), pin 6 → GND,
pin 3/GPIO2 → SDA, and pin 5/GPIO3 → SCL**. AD0 to GND selects address `0x68`;
INT is unused. The [runtime guide](README.md#optional-mpu-60506500-on-the-pi)
has setup details. The dashboard service uses `--imu-on-pi` and shows fresh
motion readings; it shows
“unavailable” if I²C communication or samples become stale.

On the Pi, `systemctl status navigen-dashboard` checks the service. The stable
USB port currently used is
`/dev/serial/by-id/usb-FTDI_FT232R_USB_UART_A5069RR4-if00-port0`.
The dashboard starts in e-stop. Holding a direction or W/A/S/D sends motion
commands; releasing stops. Space engages software e-stop. The physical switch
must cut the L298N motor supply independently of the Pi and ESP8266.
The ESP8266 cannot sense this switch while D0 is used for the buzzer. Before
closing the switch again, engage software e-stop and release every drive
control; otherwise a still-active command could restart the motors.

## Before enabling the motors

The highest measured L298N motor-supply voltage is **12.6 V** from a 3S 18650 pack
connected directly to the L298N. A 2026-10-03 measurement found about 12 V at
the same terminal with no regulator and about 3 V at each motor; the owner confirmed
3.6 V is the maximum motor voltage. Earlier photos were described as showing a
3–6 V marking, but the firmware uses the confirmed 3.6 V maximum. The requested
firmware limit is 127/255 (49.8% PWM duty), but it does not limit pulse voltage
or guarantee safe stall current. Do not drive the motors from that supply. Revise
the supply and motor driver so the motor voltage stays within its verified rating
even during energized pulses. The L298's specified operating motor supply is at
least the input-high voltage plus 2.5 V, so a 3.6 V supply at its motor input is
not a simple fix. Two motors in parallel on each channel are reported to draw
roughly 1.6–2 A at stall, close to the L298 IC's 2 A DC/channel absolute limit.
Check the switch, connectors, wire size,
L298N logic power, and driver current/thermal limits. The Pi must have its own
regulated supply. The ultrasonic ECHO signal must pass through a measured
5 V to 3.3 V divider before NodeMCU D7.

Only after these checks and a compatible power/driver design, set
`HARDWARE_CONFIGURATION_CONFIRMED=1` in the
[firmware profile](../firmware/esp8266_motor_controller/include/board_config.h)
and flash the `nodemcuv2` build. Leave `MOTOR_TEST_ENABLED=0`. Keep the chassis
on rigid stands, all wheels clear, and the switch open while flashing. With
the switch closed, verify that e-stop prevents motion before releasing it.
Then test low-effort forward, reverse, and pivots, release-to-stop, software
e-stop, physical switch, USB disconnect, and rear-obstacle stop. Any unexpected
motion or heating means disconnect motor power and diagnose it before driving
on the ground. Do not enable the directly wired D0 buzzer until its voltage
and current are confirmed GPIO-safe, or a suitable driver is fitted.

The complete wiring and first lifted-wheel test are in the
[ESP8266 firmware guide](../firmware/esp8266_motor_controller/README.md).
