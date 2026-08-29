# ESP32 Motor Controller Firmware (implemented in Phase 4)

PlatformIO project. Responsibilities: quadrature encoder counting, wheel velocity measurement
(100 Hz), independent left/right PID (100 Hz), PWM/DIR output, HC-SR04 reading, e-stop input,
battery sensing, framed serial protocol with the Pi (see docs/hardware.md), 300 ms command
watchdog that zeroes and disables propulsion.

## Configure BEFORE flashing

All hardware constants live in `include/board_config.h`. Nothing is hard-coded in the sources.
Any pin left at `-1` makes the firmware refuse to arm the motors and report an error flag.

## Build & flash

```bash
pip install platformio
pio run              # build
pio run -t upload    # flash over USB
pio device monitor   # NOT usable while the ROS bridge owns the port
```
