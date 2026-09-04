"""Static contracts for the safe physical/mock Phase 5 launch."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
import yaml


def test_real_launch_composes_description_and_hardware_with_safe_defaults() -> None:
    bringup_share = Path(get_package_share_directory('navigen_bringup'))
    hardware_share = Path(get_package_share_directory('navigen_hardware'))
    launch_text = (bringup_share / 'launch' / 'real.launch.py').read_text(
        encoding='utf-8'
    )
    hardware = yaml.safe_load(
        (hardware_share / 'config' / 'hardware.yaml').read_text(encoding='utf-8')
    )['motor_controller_bridge']['ros__parameters']

    assert "get_package_share_directory('navigen_description')" in launch_text
    assert "get_package_share_directory('navigen_hardware')" in launch_text
    assert "'use_sim': 'false'" in launch_text
    assert "'use_sim_time': 'false'" in launch_text
    assert "DeclareLaunchArgument('mock_hardware', default_value='false')" in launch_text
    assert "default_value='true'" in launch_text
    assert hardware['start_with_software_estop'] is True
    assert hardware['max_linear_velocity'] <= 0.4
    assert hardware['require_open_loop_mode'] is True
    assert 'gps' not in (launch_text + str(hardware)).lower()
