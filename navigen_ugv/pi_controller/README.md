# Raspberry Pi camera-driving runtime

This is the runnable implementation for the hardware confirmed on 2026-09-29:
Raspberry Pi + Pi Camera, ESP8266, one L298N, four motors without encoders,
one rear ultrasonic sensor, motor-power switch, and batteries. **No IMU or wheel
encoders are required. ROS is not required for this runtime.**

Features: live camera view, browser hold-to-drive controls, forward/reverse/pivot,
software e-stop, conservative command limiting, live rear distance telemetry,
browser-configurable buzzer with a 30 cm default threshold, serial reconnection
with a latched stop, and hardware-free mock mode.

This is **camera-assisted manual driving**, not autonomous A-to-B navigation.
A rear-only range sensor cannot protect forward motion. The operator watches
the camera and keeps the physical power switch accessible. Commands are nominal
open-loop effort targets: displayed PWM is real controller output, while metres
travelled and actual speed are unavailable. This hardware profile has no IMU or
wheel encoders, so this runtime publishes no pose or tracking state. The older
ROS/Gazebo vision-autonomy roadmap remains separate.

## Files

- `app.py`: local HTTP API and process lifecycle.
- `controller.py`: serial worker, motion leases, stop/release handshake and rear guard.
- `camera.py`: Picamera2 capture, acquisition-age checks, JPEG frames.
- `static/`: desktop/mobile browser controls.
- `test/`: controller and HTTP integration tests.
- `../firmware/esp8266_motor_controller/`: ESP8266 firmware, sensor pin map, and serial protocol.

The runtime imports the existing protocol, kinematics, mock and reconnecting
serial modules from `../ros2_ws/src/navigen_hardware`; keep the checkout together.

## Install on the Pi

The simplest camera-supported standalone host is Raspberry Pi OS with Picamera2.
On another OS, first verify that its libcamera/Picamera2 stack can capture from
your Pi Camera. Official [Raspberry Pi camera documentation](https://www.raspberrypi.com/documentation/computers/camera_software.html)
describes the camera software. No trained AI model is needed for manual driving.

```bash
sudo apt update
sudo apt install -y python3-picamera2 python3-opencv python3-serial python3-pytest
sudo usermod -aG dialout "$USER"
# Re-login for serial group membership. From the NAVIGEN repository root:
python3 navigen_ugv/pi_controller/app.py --mock
```

Open `http://127.0.0.1:8080`, paste the session token printed in the terminal,
and click Connect. Mock mode shows an explicitly labelled synthetic camera and
never opens a serial port. Click Release e-stop, hold a direction, then release
it. Space or the red button engages e-stop. Changing tabs or losing focus also
requests e-stop. Keyboard controls: W forward, S reverse, A left, D right.

## Connect the real UGV

1. Follow the [ESP8266 wiring/build guide](../firmware/esp8266_motor_controller/README.md).
   Firmware stays locked until its pin map and motor-power arrangement are reviewed.
2. Secure the vehicle with every wheel clear of the ground for initial tests.
3. Find the ESP8266's stable port with `ls -l /dev/serial/by-id/`.
4. Start the controller using that path:

```bash
python3 navigen_ugv/pi_controller/app.py \
  --port /dev/serial/by-id/YOUR_ESP8266 --track-width 0.34
```

Replace track width with the measured left/right wheel-centre distance; it
sets relative open-loop side commands, not measured angular speed.

For a laptop operator, use SSH forwarding:

```bash
ssh -L 8080:127.0.0.1:8080 YOUR_USER@YOUR_PI
# Then open http://127.0.0.1:8080 on the laptop.
```

The rear-distance card shows the latest fresh HC-SR04 reading. Use the buzzer
toggle and threshold slider, then choose **Apply buzzer settings**. The firmware
beeps only when the sensor reading is valid and at or inside that threshold;
with the default threshold, that means 30 cm. It stays silent beyond the chosen
distance or when the buzzer is disabled. The Pi resends settings after a serial
reconnect, and the dashboard shows the configuration reported by the ESP8266.

The server binds to loopback by default. Camera and motor APIs require a bearer
token, generated for each process unless `--token-file` is supplied. The browser
keeps the token in page memory, not browser storage.
Only one operator/browser session should control the vehicle at a time.

For boot startup, install [navigen-dashboard@.service](navigen-dashboard@.service)
as a systemd template and enable it for the Pi login user. It binds port 8080
to the Wi-Fi network and keeps its login token in that user's
`~/.config/navigen/dashboard.token` with owner-only permissions. The template
expects the checkout at `~/navigen_dashboard` and the ESP8266 on `/dev/ttyUSB0`.
The dashboard remains in e-stop until camera capture and controller telemetry
are both healthy.

```bash
sudo install -m 0644 navigen_ugv/pi_controller/navigen-dashboard@.service /etc/systemd/system/
sudo systemctl enable --now navigen-dashboard@YOUR_USER.service
cat ~/.config/navigen/dashboard.token
```

The current Pi runs Ubuntu 24.04, whose camera stack does not support the Pi CSI
camera according to the [Ubuntu Raspberry Pi support guide](https://ubuntu.com/hardware/docs/boards/how-to/ubuntu_supported/raspberry-pi/).
A camera-capable OS is needed before driving can be released.

## Stop behavior

- Starts with e-stop engaged. Release requires live camera and fresh, configured
  open-loop controller telemetry. A fresh drive command is required after release.
- Browser motion requests expire after 250 ms. Releasing a control commands zero
  immediately without a deceleration ramp. Pi sends bounded commands at 50 Hz.
- Pi stops for camera frames older than 500 ms and controller telemetry older than
  250 ms. Serial/controller faults latch e-stop and require operator release.
- Rear clearance at/below 0.35 m or invalid rear measurements blocks reverse and
  turns with a reversing wheel. Forward movement is not claimed to be collision-free.
- ESP8266 adds a 300 ms command watchdog and independently blocks reverse/pivot motion
  when the rear distance is at or inside 0.30 m or its reading is invalid/stale.
- Application shutdown sends zero and e-stop; unplugging USB is handled by firmware.
- Unavailable measurements remain unavailable. A valid “no echo” measurement is
  not assumed to mean a clear rear path.

## Verify before ground driving

Confirm startup has zero PWM; all wheel directions match controls; letting go
stops; e-stop stops; blocking the rear sensor prevents reverse/pivot; unplugging
USB stops; stopping camera capture inhibits motion; and the physical switch cuts
motor power independently. Record actual stop times and motor-power ratings.
Code tests do not validate wiring, chassis behavior, camera latency, or braking distance.

## Automated checks

```bash
python3 navigen_ugv/scripts/validate_core.py
./navigen_ugv/scripts/validate_firmware.sh
```

Development on a non-Pi machine:

```bash
uv run --with pytest --with numpy --with opencv-python --with pyserial \
  python navigen_ugv/scripts/validate_core.py
uv run --with numpy --with opencv-python --with pyserial \
  python navigen_ugv/pi_controller/app.py --mock
```

No firmware flashing, motor arming, or real movement is performed by these tests.
