# navigen_bringup

Owns top-level simulation and real-hardware composition. Phase 2 currently supplies:

- `launch/sim.launch.py`: Gazebo Harmonic, robot spawn, state publisher, bridge and optional RViz.
- `worlds/navigen_outdoor.sdf`: deterministic self-contained outdoor test world.
- `config/gz_bridge.yaml`: directional ROS↔Gazebo topic contract.
- Static and live launch tests under `test/`.

Run from a built and sourced workspace:

```bash
ros2 launch navigen_bringup sim.launch.py
ros2 launch navigen_bringup sim.launch.py \
  headless:=true software_rendering:=true rviz:=false
```

`real.launch.py` is intentionally added only when its hardware and safety dependencies reach
their phase gates.
