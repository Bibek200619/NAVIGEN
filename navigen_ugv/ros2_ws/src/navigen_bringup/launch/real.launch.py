"""Safe Phase 5 composition for the physical UGV or protocol-backed mock hardware."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    description_share = Path(get_package_share_directory('navigen_description'))
    hardware_share = Path(get_package_share_directory('navigen_hardware'))

    description = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            str(description_share / 'launch' / 'description.launch.py')
        ),
        launch_arguments={
            'use_sim': 'false',
            'use_sim_time': 'false',
            'use_gui': LaunchConfiguration('joint_state_gui'),
            'rviz': LaunchConfiguration('rviz'),
        }.items(),
    )
    hardware = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            str(hardware_share / 'launch' / 'esp32_bridge.launch.py')
        ),
        launch_arguments={
            'params_file': LaunchConfiguration('hardware_params_file'),
            'mock_hardware': LaunchConfiguration('mock_hardware'),
            'start_with_software_estop': LaunchConfiguration(
                'start_with_software_estop'
            ),
            'serial_port': LaunchConfiguration('serial_port'),
            'baud_rate': LaunchConfiguration('baud_rate'),
        }.items(),
    )

    return LaunchDescription([
        DeclareLaunchArgument(
            'hardware_params_file',
            default_value=str(hardware_share / 'config' / 'hardware.yaml'),
        ),
        DeclareLaunchArgument('mock_hardware', default_value='false'),
        DeclareLaunchArgument(
            'start_with_software_estop',
            default_value='true',
            description='Keep propulsion inhibited until /safety/e_stop is released.',
        ),
        DeclareLaunchArgument('serial_port', default_value='/dev/ttyUSB0'),
        DeclareLaunchArgument('baud_rate', default_value='115200'),
        DeclareLaunchArgument('joint_state_gui', default_value='false'),
        DeclareLaunchArgument('rviz', default_value='false'),
        description,
        hardware,
    ])
