# ESP32 Motor Controller Firmware

PlatformIO/Arduino firmware for selectable two-channel or four-channel motor output. The NAVIGEN
team profile defaults to two side channels for one L298N: both left motors share channel A and both
right motors share channel B. The firmware decodes quadrature encoders, estimates left/right
velocity, runs independent side PID controllers at 100 Hz, captures both HC-SR04 echoes without
`pulseIn`, reads e-stop and battery status, and exchanges CRC-protected telemetry with the
Raspberry Pi. A 300 ms motion-command watchdog, physical e-stop feedback, or software e-stop
immediately disables propulsion.

> **Controller check:** this project targets a genuine ESP32 development board through
> PlatformIO's `esp32dev` environment. The team's photographed NodeMCU is marked `ESP8266MOD` and
> is not compatible. Do not change the target to ESP8266 or attempt to flash this firmware to that
> board; obtain the required ESP32 before physical testing.

## Configure BEFORE flashing

All hardware constants live in `include/board_config.h`. The checked-in values intentionally
compile but cannot arm propulsion. Keep `MOTOR_OUTPUT_CHANNEL_COUNT=2` for the team's single
L298N and set and verify:

- left ENA/IN1/IN2 and right ENB/IN3/IN4 GPIOs, PWM channels, and side inversion;
- one complete quadrature encoder per side minimum (the second encoder on each side is optional);
- decoded output-shaft ticks/revolution, wheel radius, effective track width, and max wheel speed;
- independently tuned left/right PID gains and safe PWM ceiling;
- both ultrasonic TRIG/ECHO pins, physical e-stop feedback, battery ADC/divider, and optional
  shared motor-enable pin.

The firmware rejects incomplete encoder pairs, duplicate GPIOs/PWM channels, unset calibration,
unset required pins, invalid limits, and zero proportional gains. It continues sending telemetry
with `configuration_valid=false`, but never configures or enables motor outputs.

## One-L298N wiring contract

- Remove the ENA and ENB jumpers before connecting ESP32 PWM outputs.
- Connect ENA/IN1/IN2 to the configured LEFT PWM/DIR-A/DIR-B GPIOs.
- Connect ENB/IN3/IN4 to the configured RIGHT PWM/DIR-A/DIR-B GPIOs.
- Wire the two left motors in parallel to OUT1/OUT2 and the two right motors in parallel to
  OUT3/OUT4. If two motors on one side rotate in opposite vehicle directions, reverse one motor's
  leads; one shared channel cannot invert those motors independently in software.
- Join ESP32 and L298N signal grounds. Never carry motor current through a breadboard.
- Verify that one L298N channel can tolerate the sum of both motors' stall currents at the chosen
  battery voltage. If it cannot, use a correctly rated modern driver; firmware cannot fix an
  undersized or overheating power stage.

## Build & flash

```bash
pip install platformio
../../scripts/validate_firmware.sh  # native tests + two/four-channel ESP32 compile
pio run -t upload                  # flashes the default two-channel L298N build
pio device monitor                # never while the ROS bridge owns the port
```

The pinned build target is `platformio/espressif32@6.13.0`, ESP32 DevKit, C++17. The validator
compiles both `esp32dev` (two channel) and `esp32dev_four_channel`; upload defaults to
`esp32dev`. Flashing is a physical action and is deliberately not part of automated validation.

## First powered bench test

1. Keep wheels off the ground, motor supply disconnected, and the physical e-stop pressed.
2. Flash, start the ROS bridge, and confirm telemetry reports valid configuration and e-stop.
3. Connect motor power; release e-stop only with one person holding it ready.
4. Command each direction at <=0.1 m/s. Correct motor direction with `MOTOR_*_INVERTED` and
   encoder sign with `ENCODER_*_INVERTED`; do not swap signs in source code.
5. Stop ROS/USB communication while moving slowly and verify all PWM becomes zero within about
   300 ms. Press the physical e-stop and verify the independent power cut as well as telemetry.
6. Only then begin PID tuning. Keep the physical test area clear and speed <=0.4 m/s.

Wire format and Raspberry Pi commands are documented in `../../docs/hardware.md`.
