"""Phase 5 mock acceptance: safe encoderless teleoperation and e-stop."""

import os
from pathlib import Path
import time
import unittest

from ament_index_python.packages import get_package_share_directory
from geometry_msgs.msg import Twist
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription, TimerAction
from launch.launch_description_sources import PythonLaunchDescriptionSource
import launch_testing
from navigen_interfaces.msg import MotorTelemetry
import rclpy
from rclpy.qos import DurabilityPolicy, QoSProfile, ReliabilityPolicy
from sensor_msgs.msg import JointState
from std_msgs.msg import Bool
from tf2_msgs.msg import TFMessage


# Isolate this non-Gazebo launch from concurrently scheduled ROS tests.
os.environ['ROS_DOMAIN_ID'] = '57'

STARTUP_SECONDS = 2.0


def generate_test_description():
    bringup_share = Path(get_package_share_directory('navigen_bringup'))
    real_bringup = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            str(bringup_share / 'launch' / 'real.launch.py')
        ),
        launch_arguments={
            'mock_hardware': 'true',
            'start_with_software_estop': 'true',
            'rviz': 'false',
            'joint_state_gui': 'false',
        }.items(),
    )
    return LaunchDescription([
        real_bringup,
        TimerAction(
            period=STARTUP_SECONDS,
            actions=[launch_testing.actions.ReadyToTest()],
        ),
    ])


class TestRealBringupMockRuntime(unittest.TestCase):
    """Exercise the physical launch contract without connected hardware."""

    @classmethod
    def setUpClass(cls):
        rclpy.init()

    @classmethod
    def tearDownClass(cls):
        rclpy.shutdown()

    def setUp(self):
        self.node = rclpy.create_node('navigen_real_bringup_test')
        self.telemetry = None
        self.joints = None
        self.static_frames = set()
        self.telemetry_history = []

        self.node.create_subscription(
            MotorTelemetry, '/motor/telemetry', self._save_telemetry, 10
        )
        self.node.create_subscription(
            JointState, '/joint_states', self._save_joints, 10
        )
        static_qos = QoSProfile(
            depth=1,
            durability=DurabilityPolicy.TRANSIENT_LOCAL,
            reliability=ReliabilityPolicy.RELIABLE,
        )
        self.node.create_subscription(
            TFMessage, '/tf_static', self._save_static_tf, static_qos
        )
        self.command_publisher = self.node.create_publisher(Twist, '/cmd_vel', 10)
        self.estop_publisher = self.node.create_publisher(
            Bool, '/safety/e_stop', 10
        )

    def tearDown(self):
        self.node.destroy_node()

    def _save_telemetry(self, message):
        self.telemetry = message
        self.telemetry_history.append(message)

    def _save_joints(self, message):
        self.joints = message

    def _save_static_tf(self, message):
        self.static_frames.update(
            (transform.header.frame_id, transform.child_frame_id)
            for transform in message.transforms
        )

    def _spin_until(self, predicate, timeout=5.0):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            rclpy.spin_once(self.node, timeout_sec=0.02)
            if predicate():
                return True
        return False

    def _publish_for(self, publisher, message, duration, rate_hz=30.0):
        period = 1.0 / rate_hz
        deadline = time.monotonic() + duration
        while time.monotonic() < deadline:
            publisher.publish(message)
            cycle_deadline = time.monotonic() + period
            while time.monotonic() < cycle_deadline:
                rclpy.spin_once(
                    self.node,
                    timeout_sec=min(0.01, cycle_deadline - time.monotonic()),
                )

    def test_safe_start_release_bounded_motion_and_estop(self):
        required_static_frames = {
            ('base_link', 'camera_link'),
            ('base_link', 'imu_link'),
            ('base_link', 'ultrasonic_left_link'),
            ('base_link', 'ultrasonic_right_link'),
        }
        self.assertTrue(
            self._spin_until(
                lambda: self.telemetry is not None
                and self.joints is not None
                and required_static_frames <= self.static_frames
            ),
            'Real bringup did not publish telemetry, joints, and static TF.',
        )
        self.assertTrue(self.telemetry.serial_connected)
        self.assertTrue(self.telemetry.configuration_valid)
        self.assertTrue(self.telemetry.estop_active)
        self.assertTrue(self.telemetry.open_loop_mode)
        self.assertFalse(self.telemetry.wheel_feedback_valid)
        self.assertAlmostEqual(self.telemetry.left_velocity, 0.0, places=3)
        self.assertAlmostEqual(self.telemetry.right_velocity, 0.0, places=3)
        self.assertEqual(self.node.get_publishers_info_by_topic('/wheel/odom'), [])
        self.assertEqual(len(self.joints.name), 4)

        self.assertTrue(
            self._spin_until(
                lambda: self.command_publisher.get_subscription_count() == 1
                and self.estop_publisher.get_subscription_count() == 1
            )
        )
        forward = Twist()
        forward.linear.x = 0.25
        self._publish_for(self.command_publisher, forward, duration=0.4)
        self.assertTrue(self.telemetry.estop_active)
        self.assertEqual(self.telemetry.left_pwm, 0)
        self.assertEqual(self.telemetry.right_pwm, 0)

        self.estop_publisher.publish(Bool(data=False))
        self.assertTrue(
            self._spin_until(lambda: not self.telemetry.estop_active),
            'Explicit software e-stop release did not reach the controller.',
        )
        self._publish_for(self.command_publisher, forward, duration=0.8)
        self.assertTrue(
            self._spin_until(
                lambda: self.telemetry.left_pwm > 0
                and self.telemetry.right_pwm > 0
            ),
            'Bounded teleoperation did not produce open-loop PWM output.',
        )
        self.assertLessEqual(
            max(abs(sample.left_setpoint) for sample in self.telemetry_history),
            0.151,
        )

        self.estop_publisher.publish(Bool(data=True))
        self.assertTrue(
            self._spin_until(
                lambda: self.telemetry.estop_active
                and self.telemetry.left_pwm == 0
                and self.telemetry.right_pwm == 0,
                timeout=1.0,
            ),
            'Software e-stop did not immediately override physical-mode teleoperation.',
        )
