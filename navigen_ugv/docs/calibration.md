# Calibration

## Camera (critical)

1. Mechanically lock the Raspberry Pi Camera facing forward. Do not command the SG90 pan/tilt
   while localization is running.
2. Print a rigid checkerboard with accurately measured squares.
3. Install `ros-jazzy-camera-calibration`.
4. Mono example:

   ```bash
   ros2 run camera_calibration cameracalibrator \
     --size 8x6 --square 0.025 image:=/camera/image_raw
   ```

5. Fill the field of view with near/far and tilted samples. Target reprojection error below
   0.5 px, save YAML under `config/`, and use the same intrinsics in the camera driver and
   ORB-SLAM3 adapter.
6. Measure the rigid `base_link → camera_link` translation/rotation and update
   `ros2_ws/src/navigen_description/config/vehicle.yaml`.

Changing focus, resolution, lens, mount, or camera orientation invalidates calibration.

## MPU6050

Connect the MPU6050 to the Pi's 3.3 V I2C bus and mount it rigidly with known axes.

1. Enable I2C and verify the device address with `i2cdetect -y 1`.
2. Keep the complete UGV stationary and level; record at least 60 s of `/imu/data`.
3. Gyro bias is mean angular velocity. Acceleration bias is mean measured acceleration minus the
   gravity vector in the mounted orientation.
4. Enter driver bias/axis settings and verify stationary angular rates are near zero. Measure,
   rather than promise, yaw drift.
5. For ORB-SLAM3 mono-inertial mode, estimate noise density/random walk (preferably Allan variance)
   and verify camera-to-IMU time alignment and rigid extrinsics.

## Encoderless wheel/PWM calibration

There are no wheel encoders, so there is no encoder calibration or wheel-speed PID. `/motor/telemetry`
setpoints are requested wheel-surface speed; PWM is applied effort, not measured velocity.

1. With wheels on stands and a 0.05 m/s command, increase `MIN_EFFECTIVE_PWM` from zero only until
   all motors reliably start. Keep it as low as practical.
2. Verify forward/reverse polarity. Use `MOTOR_LEFT_INVERTED` and `MOTOR_RIGHT_INVERTED`; never
   alter kinematic signs in the bridge.
3. On a clear floor with a safety operator, mark a measured straight distance and time several
   low-speed runs. Adjust `MAX_WHEEL_VELOCITY_MPS` so command-to-PWM scaling is approximately
   useful at the current battery voltage.
4. If one side consistently runs faster, reduce only that side using `LEFT_PWM_SCALE` or
   `RIGHT_PWM_SCALE` (valid range >0 to 1). Repeat forward and reverse tests.
5. Measure wheel radius and effective skid-steer track width and keep the ROS description/hardware
   YAML consistent. These values convert Twist to targets; they do not create odometry.

Open-loop calibration changes with battery charge, terrain, payload, temperature, and motor wear.
It cannot provide accurate dead reckoning. The real autonomous stack must use visual-inertial pose
feedback and conservative closed-loop Nav2 body motion.

## If encoders are added later

Encoders require a different reviewed controller/pin profile and firmware path. Do not set fake
ticks-per-revolution values or derive `/wheel/odom` from commanded PWM. A later encoder profile
must measure direction-aware ticks, validate distance/yaw, and reintroduce closed-loop speed PID
with dedicated tests before its odometry is fused.
