# Simulation models

Custom Gazebo Harmonic models (rocks, trees, ramps) belong here when reusable model packages
are needed. The installed world
`ros2_ws/src/navigen_bringup/worlds/navigen_outdoor.sdf` currently uses inline primitive
obstacles, so no external downloads are required. `sim.launch.py` extends
`GZ_SIM_RESOURCE_PATH` without replacing a user's existing resource paths.
