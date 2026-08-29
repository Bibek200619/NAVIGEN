# Top-level configuration

Runtime tuning lives inside each package (installed with it):

- Vehicle geometry / TF: `ros2_ws/src/navigen_description/config/vehicle.yaml`
- Serial, kinematics limits, encoder resolution: `ros2_ws/src/navigen_hardware/config/hardware.yaml`
- Safety thresholds: `ros2_ws/src/navigen_safety/config/safety.yaml`
- Perception model + thresholds: `ros2_ws/src/navigen_perception/config/perception.yaml`
- EKF fusion: `ros2_ws/src/navigen_localization/config/ekf.yaml`
- Nav2: `ros2_ws/src/navigen_navigation/config/` (Phase 3)

This directory stores machine-specific artifacts that are NOT packages: camera calibration
YAMLs, IMU bias files, ORB-SLAM3 settings files.
