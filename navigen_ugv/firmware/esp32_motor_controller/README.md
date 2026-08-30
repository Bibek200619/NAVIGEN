# ESP32 Motor Controller Firmware

PlatformIO/Arduino firmware for four motor channels. It decodes quadrature encoders, estimates
left/right velocity, runs independent side PID controllers at 100 Hz, drives PWM/DIR outputs,
captures both HC-SR04 echoes without `pulseIn`, reads e-stop and battery status, and exchanges
CRC-protected telemetry with the Raspberry Pi. A 300 ms motion-command watchdog, physical
e-stop feedback, or software e-stop immediately disables propulsion.

## Configure BEFORE flashing

All hardware constants live in `include/board_config.h`. The checked-in values intentionally
compile but cannot arm propulsion. Set and verify:

- PWM, DIR-A, DIR-B, channel, and inversion for LF/LR/RF/RR motors;
- one complete quadrature encoder per side minimum (the second encoder on each side is optional);
- decoded output-shaft ticks/revolution, wheel radius, effective track width, and max wheel speed;
- independently tuned left/right PID gains and safe PWM ceiling;
- both ultrasonic TRIG/ECHO pins, physical e-stop feedback, battery ADC/divider, and optional
  shared motor-enable pin.

The firmware rejects incomplete encoder pairs, duplicate GPIOs/PWM channels, unset calibration,
unset required pins, invalid limits, and zero proportional gains. It continues sending telemetry
with `configuration_valid=false`, but never configures or enables motor outputs.

## Build & flash

```bash
pip install platformio
../../scripts/validate_firmware.sh  # native protocol/control tests + ESP32 compile
pio run -t upload                 # flash over USB after configuration
pio device monitor                # never while the ROS bridge owns the port
```

The pinned build target is `platformio/espressif32@6.13.0`, ESP32 DevKit, C++17. Flashing is a
physical action and is deliberately not part of automated validation.

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
