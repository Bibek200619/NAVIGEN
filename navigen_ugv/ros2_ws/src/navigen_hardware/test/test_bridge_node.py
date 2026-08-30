"""ROS-level integration tests for the protocol-backed mock hardware bridge."""

import math
from pathlib import Path
import time

from diagnostic_msgs.msg import DiagnosticArray
from geometry_msgs.msg import Twist
from nav_msgs.msg import Odometry
from navigen_hardware.esp32_bridge_node import Esp32Bridge, _int32_delta
from navigen_interfaces.msg import MotorTelemetry
import pytest
import rclpy
from rclpy.executors import SingleThreadedExecutor
from rclpy.node import Node
from rclpy.parameter import Parameter
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import BatteryState, Range
from std_msgs.msg import Bool
import yaml


PACKAGE_ROOT = Path(__file__).resolve().parents[1]


def test_installed_configuration_is_safe_and_consistent() -> None:
    parameters = yaml.safe_load(
        (PACKAGE_ROOT / 'config' / 'hardware.yaml').read_text(encoding='utf-8')
    )['esp32_bridge']['ros__parameters']
    assert parameters['mock_hardware'] is False
    assert parameters['start_with_software_estop'] is True
    assert parameters['ticks_per_revolution'] == 0.0
    assert parameters['mock_ticks_per_revolution'] > 0.0
    assert parameters['command_rate_hz'] >= 20.0
    assert parameters['telemetry_poll_rate_hz'] >= 20.0
    assert parameters['command_timeout_s'] < parameters['firmware_watchdog_timeout_s']
    assert parameters['max_linear_velocity'] <= 0.4
    assert 'gps' not in str(parameters).lower()

    launch_text = (PACKAGE_ROOT / 'launch' / 'esp32_bridge.launch.py').read_text(
        encoding='utf-8'
    )
    assert "executable='esp32_bridge'" in launch_text
    assert "DeclareLaunchArgument('mock_hardware'" in launch_text
    assert "DeclareLaunchArgument('start_with_software_estop'" in launch_text
    assert 'ParameterValue' in launch_text


def test_signed_encoder_rollover_delta() -> None:
    assert _int32_delta(-2147483648, 2147483647) == 1
    assert _int32_delta(2147483647, -2147483648) == -1


@pytest.fixture
def bridge_runtime():
    rclpy.init()
    bridge = Esp32Bridge(parameter_overrides=[
        Parameter('mock_hardware', value=True),
        Parameter('start_with_software_estop', value=False),
        Parameter('command_timeout_s', value=0.15),
        Parameter('telemetry_timeout_s', value=0.20),
    ])
    probe = Node('esp32_bridge_test_probe')
    executor = SingleThreadedExecutor()
    executor.add_node(bridge)
    executor.add_node(probe)
    try:
        yield bridge, probe, executor
    finally:
        bridge.shutdown()
        executor.remove_node(probe)
        executor.remove_node(bridge)
        probe.destroy_node()
        bridge.destroy_node()
        executor.shutdown()
        rclpy.shutdown()


def _spin_until(executor, predicate, timeout=3.0):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        executor.spin_once(timeout_sec=0.02)
        if predicate():
            return True
    return False


def _publish_for(executor, publisher, message, duration, rate_hz=30.0):
    period = 1.0 / rate_hz
    deadline = time.monotonic() + duration
    while time.monotonic() < deadline:
        publisher.publish(message)
        cycle = time.monotonic() + period
        while time.monotonic() < cycle:
            executor.spin_once(timeout_sec=min(0.01, cycle - time.monotonic()))


def test_mock_bridge_topics_motion_stale_invalid_and_estop(bridge_runtime):
    bridge, probe, executor = bridge_runtime
    received = {}
    telemetry_history = []

    def save(key, message):
        received[key] = message

    def save_telemetry(message):
        telemetry_history.append(message)
        received['telemetry'] = message

    probe.create_subscription(MotorTelemetry, '/motor/telemetry', save_telemetry, 10)
    probe.create_subscription(Odometry, '/wheel/odom', lambda msg: save('odom', msg), 10)
    probe.create_subscription(BatteryState, '/battery', lambda msg: save('battery', msg), 10)
    probe.create_subscription(
        Range,
        '/ultrasonic/front_left',
        lambda msg: save('left', msg),
        qos_profile_sensor_data,
    )
    probe.create_subscription(
        Range,
        '/ultrasonic/front_right',
        lambda msg: save('right', msg),
        qos_profile_sensor_data,
    )
    probe.create_subscription(
        DiagnosticArray, '/diagnostics', lambda msg: save('diagnostics', msg), 10
    )
    command_publisher = probe.create_publisher(Twist, '/cmd_vel', 10)
    estop_publisher = probe.create_publisher(Bool, '/safety/e_stop', 10)

    required = {'telemetry', 'odom', 'battery', 'left', 'right'}
    assert _spin_until(executor, lambda: required <= received.keys())
    assert received['telemetry'].serial_connected
    assert received['telemetry'].configuration_valid
    assert received['odom'].header.frame_id == 'odom'
    assert received['odom'].child_frame_id == 'base_link'
    assert received['battery'].voltage == pytest.approx(12.0)
    assert received['left'].header.frame_id == 'ultrasonic_left_link'
    assert received['left'].range == pytest.approx(2.5)
    assert received['right'].range == pytest.approx(2.5)

    assert _spin_until(executor, lambda: command_publisher.get_subscription_count() == 1)
    forward = Twist()
    forward.linear.x = 0.3
    start_x = received['odom'].pose.pose.position.x
    _publish_for(executor, command_publisher, forward, duration=0.45)
    assert _spin_until(
        executor,
        lambda: received['telemetry'].left_velocity > 0.1
        and received['odom'].pose.pose.position.x > start_x + 0.03,
    )
    moving_samples = [sample for sample in telemetry_history if sample.left_setpoint > 0.0]
    assert moving_samples
    assert max(sample.left_setpoint for sample in moving_samples) <= 0.301
    assert moving_samples[0].left_setpoint < moving_samples[-1].left_setpoint

    assert _spin_until(
        executor,
        lambda: abs(received['telemetry'].left_velocity) < 0.001
        and abs(received['telemetry'].right_velocity) < 0.001,
        timeout=1.0,
    ), 'A stale /cmd_vel did not force an immediate zero output'

    _publish_for(executor, command_publisher, forward, duration=0.25)
    assert _spin_until(executor, lambda: received['telemetry'].left_velocity > 0.05)
    invalid = Twist()
    invalid.linear.x = math.nan
    command_publisher.publish(invalid)
    assert _spin_until(
        executor,
        lambda: abs(received['telemetry'].left_setpoint) < 0.001
        and abs(received['telemetry'].right_setpoint) < 0.001
        and 'diagnostics' in received
        and {
            status.name: status.message for status in received['diagnostics'].status
        }.get('navigen/motion_command') == 'invalid motion command rejected',
        timeout=2.0,
    ), 'A NaN /cmd_vel was not rejected with an immediate stop diagnostic'

    _publish_for(executor, command_publisher, forward, duration=0.25)
    assert _spin_until(executor, lambda: received['telemetry'].left_velocity > 0.05)

    bridge._mock.hardware_estop = True
    assert _spin_until(
        executor,
        lambda: received['telemetry'].estop_active
        and abs(received['telemetry'].left_velocity) < 0.001,
    ), 'Controller-reported physical e-stop did not override motion'
    bridge._mock.hardware_estop = False
    _publish_for(executor, command_publisher, forward, duration=0.20)
    assert received['telemetry'].estop_active
    assert abs(received['telemetry'].left_velocity) < 0.001
    estop_publisher.publish(Bool(data=False))
    assert _spin_until(executor, lambda: not received['telemetry'].estop_active)

    _publish_for(executor, command_publisher, forward, duration=0.25)
    assert _spin_until(executor, lambda: received['telemetry'].left_velocity > 0.05)
    estop_publisher.publish(Bool(data=True))
    assert _spin_until(
        executor,
        lambda: received['telemetry'].estop_active
        and abs(received['telemetry'].left_velocity) < 0.001
        and abs(received['telemetry'].right_velocity) < 0.001,
    ), 'Software e-stop did not override motion'

    assert _spin_until(
        executor,
        lambda: 'diagnostics' in received
        and {
            status.name: status.message for status in received['diagnostics'].status
        }.get('navigen/motion_command') == 'software e-stop active'
        and {
            status.name: status.message for status in received['diagnostics'].status
        }.get('navigen/esp32_controller') == 'motor controller e-stop active',
        timeout=2.0,
    ), 'Fresh diagnostics did not reflect the active software/controller e-stop'
    statuses = {status.name: status for status in received['diagnostics'].status}
    assert statuses['navigen/esp32_transport'].message == 'connected'
    assert statuses['navigen/motion_command'].message == 'software e-stop active'
    assert statuses['navigen/esp32_controller'].message == 'motor controller e-stop active'
