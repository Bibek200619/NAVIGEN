"""Launch the Phase 3 known-map Nav2 stack without a localization backend."""

from pathlib import Path

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, OpaqueFunction
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def _launch_setup(context):
    navigation_share = Path(get_package_share_directory('navigen_navigation'))
    params_file = LaunchConfiguration('params_file')
    map_file = LaunchConfiguration('map')
    use_sim_time = LaunchConfiguration('use_sim_time')
    log_level = LaunchConfiguration('log_level')
    common_parameters = [params_file, {'use_sim_time': use_sim_time}]
    tf_remappings = [('/tf', 'tf'), ('/tf_static', 'tf_static')]

    map_server = Node(
        package='nav2_map_server',
        executable='map_server',
        name='map_server',
        output='screen',
        parameters=common_parameters + [{'yaml_filename': map_file}],
        arguments=['--ros-args', '--log-level', log_level],
        remappings=tf_remappings,
    )

    controller_server = Node(
        package='nav2_controller',
        executable='controller_server',
        name='controller_server',
        output='screen',
        parameters=common_parameters,
        arguments=['--ros-args', '--log-level', log_level],
        remappings=tf_remappings + [('cmd_vel', '/cmd_vel')],
    )

    planner_server = Node(
        package='nav2_planner',
        executable='planner_server',
        name='planner_server',
        output='screen',
        parameters=common_parameters,
        arguments=['--ros-args', '--log-level', log_level],
        remappings=tf_remappings,
    )

    behavior_server = Node(
        package='nav2_behaviors',
        executable='behavior_server',
        name='behavior_server',
        output='screen',
        parameters=common_parameters,
        arguments=['--ros-args', '--log-level', log_level],
        remappings=tf_remappings + [('cmd_vel', '/cmd_vel')],
    )

    bt_navigator = Node(
        package='nav2_bt_navigator',
        executable='bt_navigator',
        name='bt_navigator',
        output='screen',
        parameters=common_parameters + [{
            'default_nav_to_pose_bt_xml': str(
                navigation_share / 'behavior_trees' / 'navigate_to_pose.xml'
            ),
        }],
        arguments=['--ros-args', '--log-level', log_level],
        remappings=tf_remappings,
    )

    lifecycle_manager = Node(
        package='nav2_lifecycle_manager',
        executable='lifecycle_manager',
        name='lifecycle_manager_navigation',
        output='screen',
        parameters=common_parameters,
        arguments=['--ros-args', '--log-level', log_level],
    )

    map_to_odom = Node(
        package='tf2_ros',
        executable='static_transform_publisher',
        name='simulation_map_to_odom',
        output='screen',
        arguments=[
            '--x', '0', '--y', '0', '--z', '0',
            '--roll', '0', '--pitch', '0', '--yaw', '0',
            '--frame-id', 'map', '--child-frame-id', 'odom',
        ],
        condition=IfCondition(LaunchConfiguration('publish_map_to_odom')),
    )

    rviz = Node(
        package='rviz2',
        executable='rviz2',
        name='navigation_rviz',
        output='screen',
        arguments=['-d', str(navigation_share / 'rviz' / 'navigation.rviz')],
        parameters=[{'use_sim_time': use_sim_time}],
        condition=IfCondition(LaunchConfiguration('rviz')),
    )

    return [
        map_to_odom,
        map_server,
        controller_server,
        planner_server,
        behavior_server,
        bt_navigator,
        lifecycle_manager,
        rviz,
    ]


def generate_launch_description():
    navigation_share = Path(get_package_share_directory('navigen_navigation'))
    return LaunchDescription([
        DeclareLaunchArgument(
            'map',
            default_value=str(navigation_share / 'maps' / 'navigen_outdoor.yaml'),
            description='Known map used only by the Phase 3 simulation bootstrap.',
        ),
        DeclareLaunchArgument(
            'params_file',
            default_value=str(navigation_share / 'config' / 'nav2_sim.yaml'),
            description='Nav2 parameter file.',
        ),
        DeclareLaunchArgument(
            'use_sim_time', default_value='true',
            description='Use the Gazebo clock.',
        ),
        DeclareLaunchArgument(
            'publish_map_to_odom', default_value='true',
            description=(
                'Publish simulation-only identity map->odom. Disable when a real '
                'visual localization source owns this transform.'
            ),
        ),
        DeclareLaunchArgument(
            'rviz', default_value='true',
            description='Start RViz with navigation displays.',
        ),
        DeclareLaunchArgument('log_level', default_value='info'),
        OpaqueFunction(function=_launch_setup),
    ])

