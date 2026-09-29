# NAVIGEN — camera-assisted 4WD UGV

Smart India Hackathon 2026, problem statement **SIH26126**: vision-based navigation for an outdoor unmanned ground vehicle. The repository also contains a GPS-denied autonomous-navigation research track in ROS 2 and Gazebo. **The physical vehicle's current target is camera-assisted manual driving; autonomous A-to-B driving has not been demonstrated on the vehicle.**

## Current physical build

| Part | Installed role and status |
|---|---|
| Raspberry Pi 5, Ubuntu 24.04 | Runs the operator dashboard and Pi Camera Module 1 (OV5647). The camera works through a source-built libcamera/Picamera2 stack. |
| NodeMCU ESP8266 over USB | Runs CRC-protected serial telemetry and commands, a command-loss watchdog, software e-stop, rear obstacle guard, and buzzer logic. |
| One L298N and four 3–6 V TT/BO motors | Two motors share each driver channel. **Propulsion is locked out** pending corrected power and current validation. There are no wheel encoders. |
| Rear HC-SR04 | Reports live distance to the dashboard; protects reverse and pivot commands when readings are valid. A missing/stale reading blocks reverse. |
| Pi-connected motion sensor | Responds at I²C address `0x68` with identity `0x70` (MPU-6500-compatible). The dashboard shows fresh acceleration-derived roll/pitch and gyro Z turn rate. It does not provide position or wheel distance. |
| Buzzer on ESP8266 D0 | Threshold is configurable in the dashboard, but the buzzer remains off until its GPIO load or a transistor driver is verified. |
| 3S 18650 pack and physical motor switch | The measured L298N motor rail is **12.6 V** directly from the pack. Keep the motor switch off until the supply and driver are corrected. |

The live dashboard is at **[http://Hexcore.local:8080](http://Hexcore.local:8080)** on the same Wi-Fi as the Pi. Read its private login token on the Pi with:

```bash
ssh lenin@Hexcore.local 'cat ~/.config/navigen/dashboard.token'
```

Paste the token into the page and select **Connect**. The camera, rear distance, and motion cards should update. Drive controls remain unavailable while the motor-configuration lockout is active. The Pi service starts with software e-stop engaged.

The current runtime is [`navigen_ugv/pi_controller/`](navigen_ugv/pi_controller/README.md); its [operating guide](navigen_ugv/pi_controller/OPERATIONS.md) covers login, checks, and first motor commissioning. The [ESP8266 firmware guide](navigen_ugv/firmware/esp8266_motor_controller/README.md) gives the NodeMCU pin map and build instructions. ROS is **not required** to run this dashboard.

## Why the motors are locked

The motors are marked **3–6 V**, but the present 3S pack feeds **12.6 V** directly to the L298N. The firmware's 127/255 (49.8%) PWM cap limits average effort; it does **not** regulate the voltage of each pulse. Each side's two motors are reported to draw roughly 1.6–2 A together at stall, close to the L298's 2 A DC per-channel absolute limit. The checked-in firmware has `HARDWARE_CONFIGURATION_CONFIRMED=0` and records the unsafe measured voltage, so it cannot arm propulsion merely because the camera or sensors work. See the [motor-power analysis and commissioning gate](navigen_ugv/firmware/esp8266_motor_controller/README.md#motor-power-and-active-lockout).

To finish manual driving, fit and **measure** a motor supply at or below 6 V across the battery's charge range, and use a driver with current and thermal margin for both motors on each side. Verify the battery protection, fuse, physical switch, common ground, and HC-SR04 ECHO level divider. Keep the Pi on its own regulated USB-C supply. Only then update the firmware's measured-voltage record and confirmation flag, flash it with the motor switch off, and perform the [lifted-wheel stop and direction tests](navigen_ugv/firmware/esp8266_motor_controller/README.md#first-lifted-wheel-test) before ground driving.

Without encoders or a forward range sensor, the operator must watch the camera and surroundings. IMU tilt and gyro readings do not create reliable distance, heading, or obstacle detection.

## Implemented software

- **Physical runtime:** token-protected browser dashboard with live camera JPEGs, rear distance, motion readings, buzzer settings, hold-to-drive controls, and software e-stop. The Pi reconnects to the ESP8266 over USB serial. Firmware enforces a 300 ms command watchdog and a rear obstacle stop. Motor output remains locked by the current hardware profile.
- **Mock mode:** exercises the dashboard and command path without moving hardware.
- **Simulation track:** ROS 2 Jazzy packages, a 4WD description, Gazebo Harmonic world, and a known-map Nav2 point-to-point simulation. This is separate from the deployed Pi dashboard and does not prove autonomous operation on the physical UGV.

From the repository root, the portable controller and HTTP checks run with:

```bash
uv run --with pytest --with numpy --with opencv-python --with pyserial python navigen_ugv/scripts/validate_core.py
./navigen_ugv/scripts/validate_firmware.sh
```

The latest local core run passed **43 tests**; the ESP8266 native tests and pinned `nodemcuv2` build have also passed. These checks do not replace measured electrical and lifted-wheel validation.

## Repository guide

| Path | Purpose |
|---|---|
| [`navigen_ugv/pi_controller/`](navigen_ugv/pi_controller/README.md) | Deployed Pi camera/dashboard runtime and tests |
| [`navigen_ugv/firmware/esp8266_motor_controller/`](navigen_ugv/firmware/esp8266_motor_controller/README.md) | Current ESP8266 firmware, wiring, and motor lockout |
| [`navigen_ugv/ros2_ws/`](navigen_ugv/README.md) | ROS 2 packages and simulation setup |
| [`navigen_ugv/pi_controller/ubuntu24-camera.md`](navigen_ugv/pi_controller/ubuntu24-camera.md) | Tested Ubuntu 24.04 Pi Camera build |
| [`navigen_ugv/PROJECT_PROGRESS.md`](navigen_ugv/PROJECT_PROGRESS.md) | Historical phase plan and engineering evidence; older percentages do not describe the deployed manual-drive product |

The original autonomous-navigation goal remains future work: camera perception, localization, costmaps, a safety supervisor, and a physical outdoor A-to-B acceptance run. None of these is presented as active physical autonomy.

## Contributors

**Nikhil Chhetri** — AI / full-stack / DevOps development, Gazebo simulation, backend integration, and testing.
