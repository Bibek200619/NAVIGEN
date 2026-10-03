# NAVIGEN ESP8266 submission image

`ugv_esp8266_safety_locked.bin` is the compiled NodeMCU 1.0 firmware for the
confirmed pin map: L298N IN1–IN4 on D1/D2/D5/D6, rear HC-SR04 on D8/D7,
the MPU-6500 on the Pi I2C bus, and optional buzzer on D0. D3/D4 are unused
by this firmware. ENA/ENB jumpers stay installed. The Raspberry Pi communicates
through NodeMCU USB at 115200 baud.

SHA-256: `ff5a9b7d62e1ac976b5fb853caf9574dd4aa7dab7276e0160273922d64082c44`

## Preserve the old controller image first

If the NodeMCU still contains the old working firmware, back it up before an
upload. This saves a restorable binary image, although it cannot recreate the
lost source code. With `esptool` installed and the NodeMCU connected by USB:

```bash
esptool --chip esp8266 --port /dev/serial/by-id/YOUR_NODEMCU \
  read-flash 0 ALL old-esp8266-full-flash.bin
```

If your installed esptool is version 4, use `read_flash` in place of
`read-flash`. Keep the backup outside the repository because it may include
device settings. See the [Espressif read-flash guide](https://docs.espressif.com/projects/esptool/en/latest/esp8266/esptool/basic-commands.html#read-flash-contents-read-flash).

The image has `HARDWARE_CONFIGURATION_CONFIRMED=0`. It reports camera-independent
serial telemetry and reads the sensors, but cannot energize motor GPIOs. This
is intentional: the measured battery is about 12 V at the L298N motor input,
while each of the four motors has a stated 3.6 V limit. The owner also reports
about 3 V on a multimeter across each motor. That reading alone does not show
the voltage during each PWM on-pulse or the winding and driver current: the
firmware drives two motors in parallel per L298N channel and limits PWM duty to
127/255, while the motor rail remains about 12 V. A 3 V average at one setting
does not validate the maximum command, a fully charged pack, or a loaded/stalled
wheel. This image stays locked until those physical checks are complete. Keep
the physical motor switch open while flashing and testing sensors.

To rebuild and upload the same locked image from the repository root with a
NodeMCU connected by USB:

```bash
./navigen_ugv/scripts/validate_firmware.sh
pio run --project-dir navigen_ugv/firmware/esp8266_motor_controller \
  --environment nodemcuv2 --target upload
```

To start the Pi dashboard after copying this checkout to the Pi:

```bash
python3 navigen_ugv/pi_controller/app.py \
  --port /dev/serial/by-id/YOUR_NODEMCU --imu-on-pi
```

The dashboard should show camera, rear range, and MPU motion data. Its drive
controls will report the motor lockout. To commission motion later, first fit
and measure a motor power and driver arrangement compatible with the motors,
then follow `firmware/esp8266_motor_controller/README.md` for lifted-wheel tests.

## Lifted-wheel movement test

`ugv_esp8266_lifted_wheel_bench.bin` is a separate build that permits a brief
manual wheel test with all four wheels lifted clear of the ground. It is **not**
the normal driving image. SHA-256:
`3839d31b71c16c2121d559a43414f580338ff43b24860e5f69220d1bbd594768`.

The bench build caps PWM at **80/255**. Its 30-second total drive window starts
on the first nonzero motor output. Once the window expires, motor GPIOs remain
off and firmware telemetry reports configuration invalid until the ESP8266 is
rebooted. The Pi camera check, software e-stop, 300 ms command watchdog, and
rear obstacle guard still apply. The dashboard labels this build
`LIFTED-WHEEL TEST`.

1. Back up the old ESP8266 flash as above. Secure the chassis on stands with all
   four wheels clear. Keep the motor-power switch open and the buzzer disabled.
2. Connect NodeMCU USB and upload the test build:

   ```bash
   pio run --project-dir navigen_ugv/firmware/esp8266_motor_controller \
     --environment lifted_wheel_bench --target upload
   ```

3. Start the Pi dashboard with the command above. Confirm live camera, ESP8266
   telemetry, rear distance, and the `LIFTED-WHEEL TEST` label.
4. With the controls released, close the physical motor-power switch. Release
   software e-stop, briefly hold **Forward**, then release it. Watch both left
   and right wheel pairs. Engage e-stop before opening the motor-power switch.
5. Stop immediately if a wheel binds, a wire or driver heats, or rotation is
   unexpected. The 30-second window ends the test automatically. Open the motor
   switch before rebooting for another test. Ground driving requires a
   separately validated motor power and driver configuration.
