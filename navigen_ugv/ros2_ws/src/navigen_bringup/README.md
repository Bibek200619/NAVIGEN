# navigen_bringup

Owns top-level simulation and real-hardware composition:

- `launch/sim.launch.py`: Gazebo Harmonic, robot spawn, state publisher, bridge and optional RViz.
- `worlds/navigen_outdoor.sdf`: deterministic self-contained outdoor test world.
- `config/gz_bridge.yaml`: directional ROS↔Gazebo topic contract.
- `launch/real.launch.py`: shared description plus ESP32 bridge, with startup e-stop asserted.
- Static and live launch tests under `test/`.

Run from a built and sourced workspace:

```bash
ros2 launch navigen_bringup sim.launch.py
ros2 launch navigen_bringup sim.launch.py \
  headless:=true software_rendering:=true rviz:=false
ros2 launch navigen_bringup real.launch.py mock_hardware:=true rviz:=false
```

Real and mock hardware use the same launch and ROS topic contract. Mock mode is an integration
gate, not evidence that physical wiring is safe; follow `docs/hardware.md` before ground testing.
