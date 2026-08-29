# Simulation worlds

Installed Gazebo worlds are owned by ROS package
`ros2_ws/src/navigen_bringup/worlds/`. The Phase 2 outdoor validation world is
`navigen_outdoor.sdf`; keeping it in the package lets `sim.launch.py` resolve it through the
ament index after installation. This top-level directory is reserved for future non-package
world datasets and captured terrain assets.
