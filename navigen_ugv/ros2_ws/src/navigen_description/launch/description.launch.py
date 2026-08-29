"""Inspect the URDF/TF tree: robot_state_publisher + joint_state_publisher_gui + RViz."""
import os

from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition, UnlessCondition
from launch.substitutions import Command, LaunchConfiguration
from launch_ros.actions import Node
from launch_ros.parameter_descriptions import ParameterValue


def generate_launch_description():
    share = get_package_share_directory('navigen_description')
    xacro_file = os.path.join(share, 'urdf', 'navigen.urdf.xacro')
    use_sim = LaunchConfiguration('use_sim')
    use_sim_time = LaunchConfiguration('use_sim_time')
    use_gui = LaunchConfiguration('use_gui')
    rviz = LaunchConfiguration('rviz')
    robot_description = ParameterValue(
        Command(['xacro ', xacro_file, ' use_sim:=', use_sim]),
        value_type=str,
    )

    return LaunchDescription([
        DeclareLaunchArgument('use_sim', default_value='false'),
        DeclareLaunchArgument('use_sim_time', default_value='false'),
        DeclareLaunchArgument('use_gui', default_value='true'),
        DeclareLaunchArgument('rviz', default_value='true'),
        Node(
            package='robot_state_publisher',
            executable='robot_state_publisher',
            parameters=[
                {'robot_description': robot_description},
                {'use_sim_time': use_sim_time},
            ],
        ),
        Node(
            package='joint_state_publisher_gui',
            executable='joint_state_publisher_gui',
            condition=IfCondition(use_gui),
        ),
        Node(
            package='joint_state_publisher',
            executable='joint_state_publisher',
            condition=UnlessCondition(use_gui),
        ),
        Node(
            package='rviz2',
            executable='rviz2',
            arguments=['-d', os.path.join(share, 'rviz', 'navigen.rviz')],
            parameters=[{'use_sim_time': use_sim_time}],
            condition=IfCondition(rviz),
        ),
    ])
