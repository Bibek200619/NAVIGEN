# Pi Camera Module 1 on the existing Ubuntu 24.04 Pi 5

The current NAVIGEN Pi keeps its original Ubuntu SD card. [Ubuntu documents
Raspberry Pi CSI camera support starting with Ubuntu 25.04](https://documentation.ubuntu.com/hardware-support/boards/how-to/special_hardware/rpi-camera/), so this Ubuntu
24.04 setup builds the Raspberry Pi camera stack from source in
`/opt/navigen-camera`. On 2026-09-30, the Pi's OV5647 camera captured 640×480
frames through `cam` and Picamera2, and the dashboard served changing JPEG
frames. This is a tested local workaround, not an Ubuntu-packaged camera stack.

Official source projects: [libpisp](https://github.com/raspberrypi/libpisp),
[libcamera](https://github.com/raspberrypi/libcamera),
[Picamera2](https://github.com/raspberrypi/picamera2), and
[kms++](https://github.com/tomba/kmsxx).

## Rebuild the camera stack

Run on the Pi with its camera connected and power off before changing the
camera ribbon. The commands below use the source revisions tested on this Pi.

```bash
sudo apt-get update
sudo apt-get install -y git meson ninja-build pkg-config cmake python3-dev \
  python3-pip python3-venv python3-jinja2 python3-yaml python3-ply \
  pybind11-dev libboost-dev libgnutls28-dev libtiff-dev libdrm-dev \
  libjpeg-dev libcap-dev libudev-dev libevent-dev libfmt-dev
sudo usermod -aG video,render "$USER"
# Log out and back in for the new device-access groups.
mkdir -p ~/camera-stack
cd ~/camera-stack
git clone https://github.com/raspberrypi/libpisp.git
git -C libpisp checkout f8a5eb2af4c5dea76442785ef42b2fb1aa9e62f9
git clone https://github.com/raspberrypi/libcamera.git
git -C libcamera checkout 6c1dd9d55573010f710c9e190a73e7e76f0d9432
git clone https://github.com/tomba/kmsxx.git
git -C kmsxx checkout 4d2008f5893a5d6ea2b2bf5e70bc539bfcaf6db0

cd ~/camera-stack/libpisp
meson setup build --buildtype=release --prefix=/opt/navigen-camera \
  --libdir=lib -Dlogging=disabled -Dgstreamer=disabled
ninja -C build -j 4
sudo ninja -C build install

cd ~/camera-stack/libcamera
PKG_CONFIG_PATH=/opt/navigen-camera/lib/pkgconfig meson setup build \
  --buildtype=release --prefix=/opt/navigen-camera --libdir=lib \
  -Dcpp_args=-I/opt/navigen-camera/include -Dpipelines=rpi/pisp \
  -Dipas=rpi/pisp -Dpycamera=enabled -Dcam=enabled \
  -Dgstreamer=disabled -Dtest=false -Dqcam=disabled \
  -Ddocumentation=disabled -Dv4l2=disabled
ninja -C build -j 4
sudo ninja -C build install

cd ~/camera-stack/kmsxx
meson setup build --buildtype=release --prefix=/opt/navigen-camera \
  --libdir=lib -Dpykms=enabled -Dkmscube=false
ninja -C build -j 4
sudo ninja -C build install

python3 -m venv --system-site-packages ~/camera-stack/venv
~/camera-stack/venv/bin/pip install 'picamera2==0.3.37'
~/camera-stack/venv/bin/pip install 'smbus2==0.6.1'
```

The extra `cpp_args` include path is required because the installed
`libpisp.pc` advertises a nested include directory while libcamera includes
headers from the parent directory.

Verify enumeration and a real capture before starting the dashboard:

```bash
LD_LIBRARY_PATH=/opt/navigen-camera/lib /opt/navigen-camera/bin/cam -l
LD_LIBRARY_PATH=/opt/navigen-camera/lib /opt/navigen-camera/bin/cam \
  -c 1 --capture=3 -s role=viewfinder,width=640,height=480 \
  --file='/tmp/navigen-frame-#.ppm'
```

## Current Pi dashboard service

The Pi's `navigen-dashboard.service` retains its existing token and startup
behavior. The installed drop-in at
`/etc/systemd/system/navigen-dashboard.service.d/camera.conf` changes only
the Python runtime, camera-library search paths, and serial port to the stable
USB identity. Its checked-in source is
[camera-ubuntu24-current.conf](camera-ubuntu24-current.conf):

```ini
[Service]
Environment=PYTHONPATH=/opt/navigen-camera/lib/python3/dist-packages:/opt/navigen-camera/lib/python3.12/site-packages
Environment=LD_LIBRARY_PATH=/opt/navigen-camera/lib
ExecStart=
ExecStart=/home/lenin/camera-stack/venv/bin/python /home/lenin/navigen_dashboard/navigen_ugv/pi_controller/app.py --port /dev/serial/by-id/usb-FTDI_FT232R_USB_UART_A5069RR4-if00-port0 --http-port 8080 --bind 0.0.0.0 --token-file /home/lenin/.config/navigen/dashboard.token
```

After changing the drop-in, run `sudo systemctl daemon-reload` and
`sudo systemctl restart navigen-dashboard.service`. Check
`systemctl is-active navigen-dashboard.service`, then open
`http://Hexcore.local:8080` and connect with the existing dashboard token.
The camera stream is live only when `/api/camera.jpg` returns a fresh JPEG;
motor controls stay in e-stop until the firmware hardware configuration is
confirmed separately.
