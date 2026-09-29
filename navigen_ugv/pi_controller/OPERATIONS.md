# NAVIGEN manual-drive UGV: current Pi

The deployed Pi 5 runs the OV5647 Pi Camera, dashboard, and USB-connected
ESP8266. The ESP8266 reports one rear ultrasonic distance; it drives one L298N
for four motors only after the motor-power configuration is confirmed. There
are no wheel encoders, IMU, autonomous route planner, or front range sensor in
this vehicle. The operator must watch the camera for forward obstacles.

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
5. The current firmware deliberately reports **ESP8266 motor lockout active**.
   The drive controls remain unavailable until motor power is verified and the
   firmware is explicitly configured and flashed for propulsion.

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

Record the four battery cells' wiring (series/parallel), the **measured** voltage
between the L298N motor-supply + and GND terminals with the switch on, and the
voltage printed on every motor. Confirm actual motor voltage is in range and
that two motors in parallel on each L298N channel cannot exceed that channel's
stall-current rating. Check the switch, connectors, wire size, and L298N logic
power wiring. The Pi must have its own regulated supply. The ultrasonic ECHO
signal must pass through a measured 5 V to 3.3 V divider before NodeMCU D7.

Only after these checks, set `HARDWARE_CONFIGURATION_CONFIRMED=1` in the
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
