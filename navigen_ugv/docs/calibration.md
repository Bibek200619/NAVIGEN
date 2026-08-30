# Calibration

## Camera (critical for SLAM and traversability geometry)

1. Print a checkerboard (e.g. 8x6, 25 mm squares) on rigid board.
2. `sudo apt install ros-jazzy-camera-calibration`
3. Mono: `ros2 run camera_calibration cameracalibrator --size 8x6 --square 0.025 image:=/camera/image_raw`
   Stereo: `... --approximate 0.05 left:=/camera/left/image_raw right:=/camera/right/image_raw`
4. Cover the full field of view, near/far, tilted poses; calibrate until reprojection error < 0.5 px.
5. Save the YAML into `config/` and reference it from the camera driver and the ORB-SLAM3
   settings file (fx, fy, cx, cy, distortion, stereo baseline).
6. Measure the camera pose relative to base_link and update `camera:` in
   `ros2_ws/src/navigen_description/config/vehicle.yaml` (URDF/TF update automatically).

## IMU (MPU6050)

1. UGV stationary and level, record 60 s: `ros2 bag record /imu/data`.
2. Gyro bias = mean angular velocity; accel bias = mean acceleration minus gravity.
3. Enter biases in the IMU driver config; verify yaw drift < 1°/min stationary.
4. For ORB-SLAM3 inertial modes, estimate noise densities/random walk (Allan variance) or
   start from the MPU6050 datasheet values, then refine.

## Encoders

1. Determine the **decoded ticks at the gearbox output shaft** for one wheel revolution. Encoder
   datasheets use CPR/PPR inconsistently, so do not multiply by four unless the quoted value is
   explicitly single-channel cycles before quadrature decoding.
2. Set the measured value in `navigen_hardware/config/hardware.yaml` and `TICKS_PER_REV` in
   `firmware/esp32_motor_controller/include/board_config.h`.
3. Validate: push the UGV exactly 1.000 m; integrated `/wheel/odom` should read 1.00 ± 0.02 m.
4. Rotate the UGV 360° in place; adjust `track_width` (effective, usually slightly larger than
   measured for skid-steer) until yaw matches.
5. Keep `wheel_radius` and `track_width` identical in the ROS and firmware configs. Reverse wheel
   direction only through the per-motor/per-encoder inversion switches.

## Wheel PID (ESP32)

1. Wheels off the ground. Begin with a velocity step <=0.1 m/s through the bridge, then increase
   only after direction, encoder sign, e-stop, and watchdog checks pass.
2. Plot `/motor/telemetry` setpoint vs measured.
3. Raise Kp until fast response with slight overshoot, add Ki to remove steady-state error,
   small Kd only if oscillating. Tune `LEFT_PID_*` and `RIGHT_PID_*` independently, then re-verify
   at low speed on the ground. Never tune with the robot restrained by hand.
