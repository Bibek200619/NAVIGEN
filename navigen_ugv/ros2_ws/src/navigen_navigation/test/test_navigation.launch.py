"""Headless Phase 3 acceptance test for a complete NavigateToPose run."""

import math
from pathlib import Path
import time
import unittest

from action_msgs.msg import GoalStatus
from ament_index_python.packages import get_package_share_directory
from geometry_msgs.msg import Twist
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, SetEnvironmentVariable, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
import launch_testing
from lifecycle_msgs.srv import GetState
from nav2_msgs.action import NavigateToPose
from nav_msgs.msg import OccupancyGrid, Odometry, Path as NavPath
import rclpy
from rclpy.action import ActionClient
from rclpy.parameter import Parameter
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from rclpy.qos import qos_profile_sensor_data
from rosgraph_msgs.msg import Clock


STARTUP_SECONDS = 12.0
READY_TIMEOUT_SECONDS = 35.0
NAVIGATION_TIMEOUT_SECONDS = 90.0
GOAL_X = 7.0
GOAL_Y = 0.0


def generate_test_description():
    navigation_share = Path(get_package_share_directory('navigen_navigation'))
    navigation = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            str(navigation_share / 'launch' / 'nav2_sim.launch.py')
        ),
        launch_arguments={
            'headless': 'true',
            'software_rendering': 'true',
            'rviz': 'false',
            'gz_verbosity': '1',
            'log_level': 'warn',
        }.items(),
    )
    return LaunchDescription([
        SetEnvironmentVariable('GZ_PARTITION', 'navigen_phase3_navigation_test'),
        navigation,
        TimerAction(
            period=STARTUP_SECONDS,
            actions=[launch_testing.actions.ReadyToTest()],
        ),
    ])


class TestPointToPointNavigation(unittest.TestCase):
    """Verify lifecycle, obstacle-aware planning, bounded motion, arrival, and stop."""

    @classmethod
    def setUpClass(cls):
        rclpy.init()

    @classmethod
    def tearDownClass(cls):
        rclpy.shutdown()

    def setUp(self):
        self.node = rclpy.create_node(
            'navigen_navigation_acceptance_test',
            parameter_overrides=[Parameter('use_sim_time', value=True)],
        )
        self.messages = {}
        self.max_linear_command = 0.0
        self.max_angular_command = 0.0
        self.saw_motion_command = False
        self.latest_command = Twist()
        self.max_obstacle_path_deviation = 0.0

        latched_qos = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            reliability=ReliabilityPolicy.RELIABLE,
        )
        self.node.create_subscription(
            Clock, '/clock', lambda msg: self._save('clock', msg), qos_profile_sensor_data
        )
        self.node.create_subscription(
            Odometry, '/wheel/odom', lambda msg: self._save('odom', msg), 10
        )
        self.node.create_subscription(OccupancyGrid, '/map', lambda msg: self._save('map', msg), latched_qos)
        self.node.create_subscription(
            OccupancyGrid, '/global_costmap/costmap',
            lambda msg: self._save('global_costmap', msg), latched_qos,
        )
        self.node.create_subscription(
            OccupancyGrid, '/local_costmap/costmap',
            lambda msg: self._save('local_costmap', msg), latched_qos,
        )
        self.node.create_subscription(NavPath, '/plan', self._save_plan, 10)
        self.node.create_subscription(Twist, '/cmd_vel', self._save_command, 10)
        self.navigator = ActionClient(self.node, NavigateToPose, '/navigate_to_pose')

    def tearDown(self):
        self.navigator.destroy()
        self.node.destroy_node()

    def _save(self, key, message):
        self.messages[key] = message

    def _save_plan(self, message):
        self.messages['plan'] = message
        deviations = [
            abs(pose.pose.position.y)
            for pose in message.poses
            if 2.5 <= pose.pose.position.x <= 4.0
        ]
        if deviations:
            self.max_obstacle_path_deviation = max(
                self.max_obstacle_path_deviation, max(deviations)
            )

    def _save_command(self, message):
        self.latest_command = message
        self.max_linear_command = max(self.max_linear_command, abs(message.linear.x))
        self.max_angular_command = max(self.max_angular_command, abs(message.angular.z))
        self.saw_motion_command |= (
            abs(message.linear.x) > 0.02 or abs(message.angular.z) > 0.02
        )

    def _spin_until(self, predicate, timeout):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            rclpy.spin_once(self.node, timeout_sec=0.1)
            if predicate():
                return True
        return False

    def _assert_lifecycle_active(self, node_name):
        client = self.node.create_client(GetState, f'/{node_name}/get_state')
        self.assertTrue(client.wait_for_service(timeout_sec=5.0), f'{node_name} state service missing')
        future = client.call_async(GetState.Request())
        self.assertTrue(
            self._spin_until(future.done, timeout=5.0),
            f'{node_name} lifecycle query timed out',
        )
        self.assertEqual(future.result().current_state.label, 'active')
        self.node.destroy_client(client)

    def test_autonomous_goal_avoids_obstacle_reaches_target_and_stops(self):
        required = {'clock', 'odom', 'map', 'global_costmap', 'local_costmap'}
        self.assertTrue(
            self._spin_until(
                lambda: required <= self.messages.keys()
                and self.navigator.server_is_ready(),
                timeout=READY_TIMEOUT_SECONDS,
            ),
            f'Nav2 did not become ready; missing {required - self.messages.keys()}',
        )

        for node_name in (
            'map_server', 'controller_server', 'planner_server',
            'behavior_server', 'bt_navigator',
        ):
            self._assert_lifecycle_active(node_name)

        start = self.messages['odom'].pose.pose.position
        goal = NavigateToPose.Goal()
        goal.pose.header.frame_id = 'map'
        goal.pose.pose.position.x = GOAL_X
        goal.pose.pose.position.y = GOAL_Y
        goal.pose.pose.orientation.w = 1.0

        send_future = self.navigator.send_goal_async(goal)
        self.assertTrue(self._spin_until(send_future.done, timeout=10.0), 'Goal was not accepted')
        goal_handle = send_future.result()
        self.assertTrue(goal_handle.accepted, 'NavigateToPose rejected the valid map goal')

        result_future = goal_handle.get_result_async()
        self.assertTrue(
            self._spin_until(result_future.done, timeout=NAVIGATION_TIMEOUT_SECONDS),
            'NavigateToPose did not finish before the acceptance timeout',
        )
        result = result_future.result()
        self.assertEqual(result.status, GoalStatus.STATUS_SUCCEEDED)

        self.assertIn('plan', self.messages)
        self.assertGreater(
            self.max_obstacle_path_deviation, 0.55,
            'The global path did not route around the mapped central obstacle.',
        )
        self.assertTrue(self.saw_motion_command)
        self.assertLessEqual(self.max_linear_command, 0.401)
        self.assertLessEqual(self.max_angular_command, 1.001)

        self.assertTrue(
            self._spin_until(
                lambda: math.hypot(
                    self.messages['odom'].pose.pose.position.x - GOAL_X,
                    self.messages['odom'].pose.pose.position.y - GOAL_Y,
                ) <= 0.28,
                timeout=5.0,
            ),
            'Final wheel odometry is outside the configured goal tolerance.',
        )
        self.assertGreater(
            math.hypot(
                self.messages['odom'].pose.pose.position.x - start.x,
                self.messages['odom'].pose.pose.position.y - start.y,
            ),
            5.0,
        )

        self.assertTrue(
            self._spin_until(
                lambda: abs(self.latest_command.linear.x) < 0.01
                and abs(self.latest_command.angular.z) < 0.01,
                timeout=3.0,
            ),
            'Nav2 did not command a stop after reaching the goal.',
        )
