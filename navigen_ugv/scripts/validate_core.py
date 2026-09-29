#!/usr/bin/env python3
"""Portable Pi runtime and shared motor-protocol tests; no ROS or hardware needed."""
from pathlib import Path
import sys
import pytest

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
sys.path.insert(0,str(root/'ros2_ws'/'src'/'navigen_hardware'))
tests=[root/'pi_controller'/'test',
       *[root/'ros2_ws'/'src'/'navigen_hardware'/'test'/name for name in (
           'test_kinematics.py','test_serial_protocol.py',
           'test_serial_transport.py','test_mock_motor_controller.py')]]
raise SystemExit(pytest.main(['-q',*map(str,tests),*sys.argv[1:]]))
