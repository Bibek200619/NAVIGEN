"""Launch the complete NAVIGEN Gazebo Harmonic simulation interface."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import AppendEnvironmentVariable, DeclareLaunchArgument
from launch.actions import IncludeLaunchDescription, OpaqueFunction
from launch.actions import SetEnvironmentVariable, TimerAction
from launch.conditions import IfCondition
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def _as_bool(value: str) -> bool:
    return value.strip().lower() in {'1', 'true', 'yes', 'on'}


def _launch_setup(context):
    bringup_share = Path(get_package_share_directory('navigen_bringup'))
    description_share = Path(get_package_share_directory('navigen_description'))
    ros_gz_sim_share = Path(get_package_share_directory('ros_gz_sim'))

    world = LaunchConfiguration('world').perform(context)
    headless = _as_bool(LaunchConfiguration('headless').perform(context))
    gz_args = ['-r', '-v', LaunchConfiguration('gz_verbosity').perform(context)]
    if headless:
        gz_args.extend(['-s', '--headless-rendering'])
    gz_args.append(world)

    robot_description = ParameterValue(
        Command([
            'xacro ',
            str(description_share / 'urdf' / 'navigen.urdf.xacro'),
            ' use_sim:=true',
        ]),
        value_type=str,
    )

    gazebo = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            str(ros_gz_sim_share / 'launch' / 'gz_sim.launch.py')
        ),
        launch_arguments={
            'gz_args': ' '.join(gz_args),
            'on_exit_shutdown': 'true',
        }.items(),
    )

    state_publisher = Node(
        package='robot_state_publisher',
        executable='robot_state_publisher',
        name='robot_state_publisher',
        output='screen',
        parameters=[{
            'robot_description': robot_description,
            'use_sim_time': LaunchConfiguration('use_sim_time'),
        }],
    )

    bridge = Node(
        package='ros_gz_bridge',
        executable='parameter_bridge',
        name='gz_bridge',
        output='screen',
        parameters=[{
            'config_file': str(bringup_share / 'config' / 'gz_bridge.yaml'),
            'use_sim_time': LaunchConfiguration('use_sim_time'),
        }],
    )

    spawn_robot = Node(
        package='ros_gz_sim',
        executable='create',
        name='spawn_navigen',
        output='screen',
        arguments=[
            '-world', LaunchConfiguration('world_name'),
            '-topic', 'robot_description',
            '-name', LaunchConfiguration('robot_name'),
            '-allow_renaming', 'false',
            '-x', LaunchConfiguration('spawn_x'),
            '-y', LaunchConfiguration('spawn_y'),
            '-z', LaunchConfiguration('spawn_z'),
            '-Y', LaunchConfiguration('spawn_yaw'),
        ],
    )

    rviz = Node(
        package='rviz2',
        executable='rviz2',
        name='rviz2',
        output='screen',
        arguments=['-d', str(description_share / 'rviz' / 'navigen.rviz')],
        parameters=[{'use_sim_time': LaunchConfiguration('use_sim_time')}],
        condition=IfCondition(LaunchConfiguration('rviz')),
    )

    actions = [
        AppendEnvironmentVariable(
            'GZ_SIM_RESOURCE_PATH', str(bringup_share / 'worlds')
        ),
    ]
    if _as_bool(LaunchConfiguration('software_rendering').perform(context)):
        actions.append(SetEnvironmentVariable('LIBGL_ALWAYS_SOFTWARE', '1'))

    actions.extend([
        gazebo,
        state_publisher,
        bridge,
        TimerAction(period=2.0, actions=[spawn_robot]),
        rviz,
    ])
    return actions


def generate_launch_description():
    bringup_share = Path(get_package_share_directory('navigen_bringup'))
    default_world = str(bringup_share / 'worlds' / 'navigen_outdoor.sdf')

    return LaunchDescription([
        DeclareLaunchArgument(
            'world', default_value=default_world,
            description='Absolute path to an SDF world file.',
        ),
        DeclareLaunchArgument(
            'world_name', default_value='navigen_outdoor',
            description='SDF world name used by the entity-creation service.',
        ),
        DeclareLaunchArgument(
            'robot_name', default_value='navigen',
            description='Gazebo model name. Keep navigen when using the default bridge.',
        ),
        DeclareLaunchArgument(
            'headless', default_value='false',
            description='Run server-only with headless rendering for CI or SSH.',
        ),
        DeclareLaunchArgument(
            'rviz', default_value='true',
            description='Start RViz2 with the NAVIGEN display configuration.',
        ),
        DeclareLaunchArgument(
            'use_sim_time', default_value='true',
            description='Use Gazebo /clock for all ROS nodes.',
        ),
        DeclareLaunchArgument(
            'software_rendering', default_value='false',
            description='Force Mesa software rendering (useful in containers).',
        ),
        DeclareLaunchArgument('spawn_x', default_value='0.0'),
        DeclareLaunchArgument('spawn_y', default_value='0.0'),
        DeclareLaunchArgument(
            'spawn_z', default_value='0.08',
            description='Base-link height; default places wheels just above terrain.',
        ),
        DeclareLaunchArgument('spawn_yaw', default_value='0.0'),
        DeclareLaunchArgument(
            'gz_verbosity', default_value='2',
            description='Gazebo verbosity from 0 (quiet) to 4 (debug).',
        ),
        OpaqueFunction(function=_launch_setup),
    ])
