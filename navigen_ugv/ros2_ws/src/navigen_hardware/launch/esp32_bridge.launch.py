"""Launch the configurable ESP32 bridge in real or mock mode."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    share = Path(get_package_share_directory('navigen_hardware'))
    return LaunchDescription([
        DeclareLaunchArgument(
            'params_file', default_value=str(share / 'config' / 'hardware.yaml')
        ),
        DeclareLaunchArgument('mock_hardware', default_value='false'),
        DeclareLaunchArgument('start_with_software_estop', default_value='true'),
        DeclareLaunchArgument('serial_port', default_value='/dev/ttyUSB0'),
        DeclareLaunchArgument('baud_rate', default_value='115200'),
        Node(
            package='navigen_hardware',
            executable='esp32_bridge',
            name='esp32_bridge',
            output='screen',
            parameters=[
                LaunchConfiguration('params_file'),
                {
                    'mock_hardware': ParameterValue(
                        LaunchConfiguration('mock_hardware'), value_type=bool
                    ),
                    'start_with_software_estop': ParameterValue(
                        LaunchConfiguration('start_with_software_estop'), value_type=bool
                    ),
                    'serial_port': LaunchConfiguration('serial_port'),
                    'baud_rate': ParameterValue(
                        LaunchConfiguration('baud_rate'), value_type=int
                    ),
                },
            ],
        ),
    ])
