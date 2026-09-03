"""Headless Phase 2 integration test: spawn, sensors, TF and bounded motion."""

import math
from pathlib import Path
import time
import unittest

from ament_index_python.packages import get_package_share_directory
from geometry_msgs.msg import Twist
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, SetEnvironmentVariable, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
import launch_testing
from nav_msgs.msg import Odometry
import rclpy
from rclpy.qos import qos_profile_sensor_data
from rosgraph_msgs.msg import Clock
from sensor_msgs.msg import CameraInfo, Image, Imu, JointState
from tf2_msgs.msg import TFMessage


STARTUP_SECONDS = 10.0
MESSAGE_TIMEOUT_SECONDS = 20.0


def generate_test_description():
    bringup_share = Path(get_package_share_directory('navigen_bringup'))
    simulation = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(str(bringup_share / 'launch' / 'sim.launch.py')),
        launch_arguments={
            'headless': 'true',
            'software_rendering': 'true',
            'rviz': 'false',
            'gz_verbosity': '1',
        }.items(),
    )
    return LaunchDescription([
        SetEnvironmentVariable('GZ_PARTITION', 'navigen_phase2_simulation_test'),
        simulation,
        TimerAction(
            period=STARTUP_SECONDS,
            actions=[launch_testing.actions.ReadyToTest()],
        ),
    ])


class TestSimulationRuntime(unittest.TestCase):
    """Assert the same ROS contract later consumed by localization and Nav2."""

    @classmethod
    def setUpClass(cls):
        rclpy.init()

    @classmethod
    def tearDownClass(cls):
        rclpy.shutdown()

    def setUp(self):
        self.node = rclpy.create_node('navigen_simulation_test')
        self.messages = {}
        self.has_odom_tf = False

        self.node.create_subscription(
            Clock, '/clock', lambda msg: self._save('clock', msg), qos_profile_sensor_data
        )
        self.node.create_subscription(
            Odometry, '/wheel/odom', lambda msg: self._save('odom', msg), 10
        )
        self.node.create_subscription(
            JointState, '/joint_states', lambda msg: self._save('joints', msg), 10
        )
        self.node.create_subscription(
            Image, '/camera/image_raw', lambda msg: self._save('image', msg),
            qos_profile_sensor_data,
        )
        self.node.create_subscription(
            CameraInfo, '/camera/camera_info', lambda msg: self._save('camera_info', msg),
            qos_profile_sensor_data,
        )
        self.node.create_subscription(
            Imu, '/imu/data', lambda msg: self._save('imu', msg), qos_profile_sensor_data
        )
        self.node.create_subscription(TFMessage, '/tf', self._save_tf, 20)
        self.cmd_vel = self.node.create_publisher(Twist, '/cmd_vel', 10)

    def tearDown(self):
        self.node.destroy_node()

    def _save(self, key, message):
        self.messages[key] = message

    def _save_tf(self, message):
        self.messages['tf'] = message
        self.has_odom_tf |= any(
            transform.header.frame_id == 'odom'
            and transform.child_frame_id == 'base_link'
            for transform in message.transforms
        )

    def _spin_until(self, predicate, timeout=MESSAGE_TIMEOUT_SECONDS):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            rclpy.spin_once(self.node, timeout_sec=0.1)
            if predicate():
                return True
        return False

    def _publish_for(self, publisher, message, duration, rate_hz=10.0):
        period = 1.0 / rate_hz
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            cycle_deadline = time.monotonic() + period
            publisher.publish(message)
            while time.monotonic() < cycle_deadline:
                remaining = cycle_deadline - time.monotonic()
                rclpy.spin_once(self.node, timeout_sec=min(0.02, remaining))

    def test_required_topics_frames_and_motion(self):
        required = {'clock', 'odom', 'joints', 'image', 'camera_info', 'imu', 'tf'}
        self.assertTrue(
            self._spin_until(lambda: required <= self.messages.keys() and self.has_odom_tf),
            f'Missing live data: {required - self.messages.keys()}, odom_tf={self.has_odom_tf}',
        )

        odom = self.messages['odom']
        self.assertEqual(odom.header.frame_id, 'odom')
        self.assertEqual(odom.child_frame_id, 'base_link')
        self.assertEqual(self.messages['image'].header.frame_id, 'camera_optical_frame')
        self.assertEqual(self.messages['camera_info'].header.frame_id, 'camera_optical_frame')
        self.assertEqual(self.messages['imu'].header.frame_id, 'imu_link')
        self.assertEqual((self.messages['image'].width, self.messages['image'].height), (320, 240))
        self.assertEqual(
            set(self.messages['joints'].name),
            {
                'front_left_wheel_joint', 'front_right_wheel_joint',
                'rear_left_wheel_joint', 'rear_right_wheel_joint',
            },
        )

        start_x = odom.pose.pose.position.x
        start_y = odom.pose.pose.position.y
        command = Twist()
        command.linear.x = 0.2

        self.assertTrue(
            self._spin_until(lambda: self.cmd_vel.get_subscription_count() > 0, timeout=5.0),
            'Gazebo did not subscribe to /cmd_vel through the bridge.',
        )
        self._publish_for(self.cmd_vel, command, duration=2.5)
        self._publish_for(self.cmd_vel, Twist(), duration=0.5)
        self.assertTrue(
            self._spin_until(
                lambda: math.hypot(
                    self.messages['odom'].pose.pose.position.x - start_x,
                    self.messages['odom'].pose.pose.position.y - start_y,
                ) > 0.15,
                timeout=8.0,
            ),
            'Bounded /cmd_vel command did not move wheel odometry by 0.15 m.',
        )
