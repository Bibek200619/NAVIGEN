# Hardware

## Confirmed team profile

The 2026-09-05 inventory, photo, and product-listing audit establishes this physical profile:

- Raspberry Pi 5 with Raspberry Pi Camera; no mobile Pi power source has been approved yet;
- NodeMCU 1.0 carrying an `ESP8266MOD` / ESP-12 module, connected to the Pi by USB;
- one L298N, four encoderless yellow TT geared motors, and a 4WD skid-steer chassis;
- one MPU6050, at least one HC-SR04, one physical switch, three-cell 18650 holder,
  breadboard/jumpers/resistors, SG90 servos, and a pan/tilt mount. The user has excluded the relay
  module and buck converter from the build.

The supplied Blessaro listing identifies the chassis motors as **3-6 V DC, 200 RPM dual-shaft BO
motors** with a 1:48 gearbox, 208 RPM no-load speed at 5 V, 0.8 kg.cm rated torque at 5 V, and
170 mA load current per motor at 4.5 V. It does not publish stall current. The title says
"compatible with ... speed encoder"; it does not say encoders are included, and the photographed
motors expose only two power wires. Product reference:
<https://www.amazon.in/dp/B0GHJCXHWK>.

The executable hardware profile now supports exactly those encoderless propulsion parts. It does
not fabricate encoder feedback or wheel odometry. This is enough for Phase 5 open-loop
teleoperation; later real autonomy must localize from the fixed camera + MPU6050 visual-inertial
pipeline.

## What is and is not connected

| Part | Connection / role |
|---|---|
| Raspberry Pi Camera | Pi CSI camera connector; fixed forward during localization |
| MPU6050 | Raspberry Pi 3.3 V I2C (`SDA1` GPIO2, `SCL1` GPIO3), not ESP8266 |
| NodeMCU ESP8266 | Pi USB serial; motor watchdog, PWM, stop feedback, ultrasonic telemetry |
| L298N channel A | two left motors in parallel |
| L298N channel B | two right motors in parallel |
| One HC-SR04 | centered at the front; backup stop sensor, not primary navigation |
| Physical switch | independent L298N motor-power cut, with active-low feedback to D0 |
| Relay and buck converter | not connected or used in the current hardware plan |
| SG90 / pan-tilt | disconnected; camera mount mechanically locked at center |
| Relay module | not controlled by the ESP8266 as the sole emergency-stop path |
| Encoders | absent; no real `/wheel/odom`, speed PID, or tick feedback |

If more HC-SR04 modules are available, keep them disconnected for this pin-limited profile. Adding
them later needs a reviewed GPIO-expansion or controller change; do not steal boot, serial, motor,
or stop pins.

## NodeMCU to L298N and HC-SR04 map

All executable pin definitions live in
`firmware/esp8266_motor_controller/include/board_config.h`.

| NodeMCU label | ESP8266 GPIO | Connect to |
|---|---:|---|
| D1 | 5 | L298N IN1 |
| D2 | 4 | L298N IN2 |
| D5 | 14 | L298N IN3 |
| D6 | 12 | L298N IN4 |
| D8 | 15 | centered HC-SR04 TRIG |
| D7 | 13 | centered HC-SR04 ECHO through verified 5 V→3.3 V divider |
| D0 | 16 | active-low physical motor-power feedback |

Keep both L298N **ENA and ENB jumpers installed**. Firmware applies software PWM to one direction
input at a time. Wire both left motors to OUT1/OUT2 and both right motors to OUT3/OUT4. If two
motors sharing one side rotate in opposite vehicle directions, reverse one motor's two leads.

D8/GPIO15 participates in ESP8266 boot selection and must remain LOW at boot. Use it only for the
HC-SR04's high-impedance TRIG input and never add a pull-up. HC-SR04 ECHO is 5 V and must never be
connected directly to the 3.3 V NodeMCU.

The one centered range is carried in the protocol's first ultrasonic slot and currently appears as
`/ultrasonic/front_left` for interface compatibility. `/ultrasonic/front_right` is published as
invalid/NaN. The physical mounting—not the legacy topic suffix—is centered.

## Power and physical-stop contract

- **Active Phase 5 power gate:** the motors are rated for 3-6 V. Never connect the photographed
  three-cell 18650 holder directly to the L298N motor input. A standard 3S lithium-ion stack is
  11.1 V nominal and 12.6 V fully charged, which is outside the motor specification.
- The L298N is a switching bridge, not a voltage regulator. Firmware PWM cannot make an unsafe
  12.6 V rail into an approved 3-6 V motor supply; at full command the current configuration uses
  full duty cycle.
- Because the user is not using a buck converter, the three-cell 18650 holder is excluded from
  propulsion. Use a known **3-6 V motor battery** with sufficient continuous/transient current and
  a fuse instead—for example, a correctly assembled four-cell NiMH pack. Verify its maximum
  voltage with a multimeter before connecting the driver.
- Identify the exact 18650 cells and prove that the assembled pack has suitable 3S protection,
  balancing/charging, and a fuse. A plastic holder alone is not a BMS. Do not charge cells in the
  holder until this is established.
- The L298N data sheet permits at most 2 A DC per channel. Because each channel supplies two
  motors in parallel and the listing omits stall current, the side-pair stall/current margin is
  still unverified.
- Power the Pi separately through USB-C from a regulated supply or power bank. Raspberry Pi 5
  recommends 5 V / 5 A; a 5 V / 3 A supply restricts the peripheral power budget. Never power the
  Pi from the L298N 5 V terminal, NodeMCU regulator, motor battery, or breadboard rail.
- Route motor current with appropriately sized wire, not the breadboard or jumper wires.
- Join Pi/NodeMCU/L298N signal grounds. Keep motor wiring away from camera and I2C wiring.
- Verify the L298N channel can tolerate the combined stall current of two motors and provide
  cooling. Stop immediately if the board, wires, switch, or battery gets hot.

The available physical switch must open the L298N motor-supply path independently of all code. It
must be rated for the measured motor current. D0 must also read HIGH only while propulsion power is
available and LOW when the switch opens. Use an auxiliary switch contact if present. Otherwise,
the switched motor rail may be sensed only through a divider designed from the measured minimum
and maximum rail voltages and verified with a multimeter. Never connect battery voltage directly
to D0. If reliable 3.3 V feedback cannot be produced from the available parts, physical movement
may be tested only under manual power-cut supervision and Phase 5 remains incomplete.

A small relay module is not automatically an e-stop: its 10 A marking generally describes a
resistive load, not this motor pair's inductive stall current or the module PCB traces. Do not use a
relay controlled by the same ESP8266 as the only power-removal path.

## Why there is no wheel odometry

The photographed motors expose only two power wires. Software cannot infer direction-aware wheel
rotation from them. Therefore real/mock hardware:

- reports `open_loop_mode=true` and `wheel_feedback_valid=false`;
- reports measured wheel velocities and cumulative ticks as zero;
- publishes PWM/setpoint telemetry but never `/wheel/odom`.

Gazebo still publishes truthful simulated `/wheel/odom` in Phases 2–3. The final real navigation
pipeline will use `/visual_odom` from mono-inertial ORB-SLAM3 and fuse the appropriate IMU/VIO
signals into `/odometry/filtered`. Open-loop PWM cannot maintain exact distance or heading; motor,
battery, surface, and load variation will cause drift.

## Serial protocol (Pi ⇄ ESP8266)

Little-endian binary frame:

`AA 55 | version:u8 | msg_id:u8 | sequence:u16 | payload_len:u8 | payload | crc8`

Protocol version is `2`; payload is limited to 64 bytes. CRC-8/ATM uses polynomial `0x07`, initial
value `0x00`, and covers `version` through payload. Bad version, length, CRC, payload shape, and
stale ordered commands are rejected.

- `0x01` CMD_VELOCITY: int16 left/right wheel-surface target in mm/s, Pi→ESP8266 at 20–50 Hz.
- `0x02` CMD_ESTOP: uint8 active.
- `0x10` TELEMETRY: zero measured velocities/ticks, signed applied PWM, optional battery mV,
  ultrasonic slot 1, flags, acknowledged sequence, command age, and CRC reject count.
- Flags: bit 0 e-stop, bit 1 watchdog, bit 2 invalid configuration, bit 3 open-loop mode.

Golden velocity frame (sequence `0x1234`, left `+0.250 m/s`, right `-0.250 m/s`):
`aa550201341204fa0006ffb7`.

No valid velocity command for 300 ms forces zero PWM. E-stop always wins. The Pi bridge also sends
zero when `/cmd_vel` is stale or invalid and latches transport/controller stop events.

## Raspberry Pi bridge

Configuration is in `ros2_ws/src/navigen_hardware/config/hardware.yaml`. Defaults are deliberately
conservative: 0.15 m/s linear, 0.50 rad/s angular, and 0.20 m/s wheel-surface target.

```bash
ros2 launch navigen_bringup real.launch.py mock_hardware:=true rviz:=false
./scripts/estop.sh release --confirm
ros2 topic pub -r 20 /cmd_vel geometry_msgs/msg/Twist '{linear: {x: 0.1}}'
ros2 topic echo /motor/telemetry
ros2 topic echo /diagnostics
./scripts/estop.sh engage
```

Mock mode uses the exact protocol and open-loop safety behavior. It does not simulate distance,
encoder ticks, or `/wheel/odom`.

## Phase 5 lifted-wheel gate

Use two people: one sends commands; one stays at the physical motor-power switch. Secure the
chassis on rigid stands with every wheel clear.

Preparation:

1. Keep all 18650 cells removed. Obtain a multimeter and a known 3-6 V motor battery; the 3S holder
   is not part of this no-buck plan. Record the motor-source maximum voltage/current, motor stall
   current, switch/driver ratings, wheel diameter, and effective track width; do not infer missing
   values from the seller's page.
2. Wire the map above, verify both divider outputs with a multimeter, and peer-review polarity.
3. Run `./scripts/validate_firmware.sh`. Set `HARDWARE_CONFIGURATION_CONFIRMED=1` only after that
   review, rebuild, and flash `nodemcuv2`.
4. Copy measured geometry into `navigen_hardware/config/hardware.yaml` and
   `navigen_description/config/vehicle.yaml`. Keep first motion at 0.05 m/s.
5. On the Pi, find the stable port with `ls -l /dev/serial/by-id/`.

Test:

1. Open the physical motor-power switch. Connect NodeMCU USB and launch real mode; leave software
   e-stop asserted.
2. Require `serial_connected=true`, `configuration_valid=true`, `open_loop_mode=true`,
   `wheel_feedback_valid=false`, zero PWM, and healthy transport diagnostics.
3. Close motor power. Wheels must remain stopped by software e-stop.
4. Release software e-stop, command forward/reverse/left/right briefly, and verify all four wheel
   directions. Correct side direction only with `MOTOR_*_INVERTED`.
5. Tune `MIN_EFFECTIVE_PWM` and reduce the faster side with `LEFT_PWM_SCALE` or
   `RIGHT_PWM_SCALE`; never set either scale above 1.0.
6. Engage software e-stop while moving: both PWM values and all wheels must go to zero. Re-release,
   move slowly, then open the physical switch: the wheels must stop independently of firmware.
7. Re-closing physical power must leave the Pi-side stop latched until an explicit
   `estop.sh release --confirm`.
8. Move slowly and unplug USB. Wheels must stop within about 300 ms and must not restart on
   reconnect without fresh commands.
9. Stop teleop, assert both stops, disconnect battery, and save telemetry/diagnostic evidence.

Any unexpected movement, reset, hot component, failed stop, or stale/invalid telemetry is RED.
Remove motor power, correct the cause, and repeat from step 1. Ground testing is forbidden until
every lifted-wheel item is green.
