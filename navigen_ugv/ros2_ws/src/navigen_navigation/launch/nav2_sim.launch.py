"""Launch Gazebo and the Phase 3 Nav2 point-to-point demonstration."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, IncludeLaunchDescription, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import LaunchConfiguration


def generate_launch_description():
    bringup_share = Path(get_package_share_directory('navigen_bringup'))
    navigation_share = Path(get_package_share_directory('navigen_navigation'))

    simulation = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(str(bringup_share / 'launch' / 'sim.launch.py')),
        launch_arguments={
            'world': LaunchConfiguration('world'),
            'headless': LaunchConfiguration('headless'),
            'software_rendering': LaunchConfiguration('software_rendering'),
            'rviz': 'false',
            'use_sim_time': LaunchConfiguration('use_sim_time'),
            'spawn_x': LaunchConfiguration('spawn_x'),
            'spawn_y': LaunchConfiguration('spawn_y'),
            'spawn_z': LaunchConfiguration('spawn_z'),
            'spawn_yaw': LaunchConfiguration('spawn_yaw'),
            'gz_verbosity': LaunchConfiguration('gz_verbosity'),
        }.items(),
    )

    navigation = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            str(navigation_share / 'launch' / 'navigation.launch.py')
        ),
        launch_arguments={
            'map': LaunchConfiguration('map'),
            'params_file': LaunchConfiguration('params_file'),
            'use_sim_time': LaunchConfiguration('use_sim_time'),
            'publish_map_to_odom': 'true',
            'rviz': LaunchConfiguration('rviz'),
            'log_level': LaunchConfiguration('log_level'),
        }.items(),
    )

    return LaunchDescription([
        DeclareLaunchArgument(
            'world',
            default_value=str(bringup_share / 'worlds' / 'navigen_outdoor.sdf'),
        ),
        DeclareLaunchArgument(
            'map',
            default_value=str(navigation_share / 'maps' / 'navigen_outdoor.yaml'),
        ),
        DeclareLaunchArgument(
            'params_file',
            default_value=str(navigation_share / 'config' / 'nav2_sim.yaml'),
        ),
        DeclareLaunchArgument('headless', default_value='false'),
        DeclareLaunchArgument('software_rendering', default_value='false'),
        DeclareLaunchArgument('rviz', default_value='true'),
        DeclareLaunchArgument('use_sim_time', default_value='true'),
        DeclareLaunchArgument('spawn_x', default_value='0.0'),
        DeclareLaunchArgument('spawn_y', default_value='0.0'),
        DeclareLaunchArgument('spawn_z', default_value='0.08'),
        DeclareLaunchArgument('spawn_yaw', default_value='0.0'),
        DeclareLaunchArgument('gz_verbosity', default_value='2'),
        DeclareLaunchArgument('log_level', default_value='info'),
        simulation,
        TimerAction(period=3.0, actions=[navigation]),
    ])
