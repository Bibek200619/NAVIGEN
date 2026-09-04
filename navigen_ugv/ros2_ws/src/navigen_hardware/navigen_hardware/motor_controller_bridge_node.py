"""ROS 2 bridge between body velocity commands and the serial motor controller."""

from __future__ import annotations

import math
import time

from diagnostic_msgs.msg import DiagnosticArray, DiagnosticStatus, KeyValue
from geometry_msgs.msg import Twist
from navigen_interfaces.msg import MotorTelemetry
import rclpy
from rclpy.node import Node
from rclpy.qos import qos_profile_sensor_data
from sensor_msgs.msg import BatteryState, Range
from std_msgs.msg import Bool

from navigen_hardware.kinematics import (
    DiffDriveKinematics,
    KinematicsConfig,
    MotionCommandLimiter,
)
from navigen_hardware.mock_motor_controller import MockMotorController
from navigen_hardware import serial_protocol as protocol
from navigen_hardware.serial_transport import ReconnectingSerial


DEFAULT_PARAMETERS = {
    'mock_hardware': False,
    'start_with_software_estop': True,
    'serial_port': '/dev/ttyUSB0',
    'baud_rate': 115200,
    'reconnect_interval_s': 1.0,
    'command_rate_hz': 30.0,
    'telemetry_poll_rate_hz': 50.0,
    'command_timeout_s': 0.20,
    'telemetry_timeout_s': 0.25,
    'firmware_watchdog_timeout_s': 0.30,
    'require_open_loop_mode': True,
    'mock_battery_voltage': 12.0,
    'mock_ultrasonic_left': 2.5,
    'mock_ultrasonic_right': -1.0,
    'mock_max_pwm': 255,
    'wheel_radius': 0.0625,
    'track_width': 0.34,
    'max_linear_velocity': 0.40,
    'max_angular_velocity': 1.00,
    'max_wheel_velocity': 0.60,
    'max_linear_acceleration': 0.80,
    'max_angular_acceleration': 2.00,
    'base_frame': 'base_link',
    'ultrasonic_left_frame': 'ultrasonic_left_link',
    'ultrasonic_right_frame': 'ultrasonic_right_link',
    'ultrasonic_min_range': 0.02,
    'ultrasonic_max_range': 4.0,
    'ultrasonic_field_of_view': 0.26,
}


class MotorControllerBridge(Node):
    """Own serial communication, safety gating, and honest open-loop telemetry."""

    def __init__(self, **kwargs):
        super().__init__('motor_controller_bridge', **kwargs)
        for name, default in DEFAULT_PARAMETERS.items():
            self.declare_parameter(name, default)

        self._mock_hardware = bool(self._parameter('mock_hardware'))
        self._command_rate = float(self._parameter('command_rate_hz'))
        self._poll_rate = float(self._parameter('telemetry_poll_rate_hz'))
        self._command_timeout = float(self._parameter('command_timeout_s'))
        self._telemetry_timeout = float(self._parameter('telemetry_timeout_s'))
        self._firmware_watchdog = float(
            self._parameter('firmware_watchdog_timeout_s')
        )
        self._require_open_loop = bool(self._parameter('require_open_loop_mode'))
        self._validate_timing()

        config = KinematicsConfig(
            wheel_radius=float(self._parameter('wheel_radius')),
            track_width=float(self._parameter('track_width')),
            max_linear_velocity=float(self._parameter('max_linear_velocity')),
            max_angular_velocity=float(self._parameter('max_angular_velocity')),
            max_wheel_velocity=float(self._parameter('max_wheel_velocity')),
        )
        self._kinematics = DiffDriveKinematics(config)
        self._limiter = MotionCommandLimiter(
            self._kinematics,
            float(self._parameter('max_linear_acceleration')),
            float(self._parameter('max_angular_acceleration')),
        )
        self._base_frame = str(self._parameter('base_frame'))
        self._left_range_frame = str(self._parameter('ultrasonic_left_frame'))
        self._right_range_frame = str(self._parameter('ultrasonic_right_frame'))
        self._range_min = float(self._parameter('ultrasonic_min_range'))
        self._range_max = float(self._parameter('ultrasonic_max_range'))
        self._range_fov = float(self._parameter('ultrasonic_field_of_view'))
        if not (0.0 <= self._range_min < self._range_max and self._range_fov > 0.0):
            raise ValueError('ultrasonic range and field-of-view parameters are invalid')

        self._parser = protocol.FrameParser()
        self._command_sequence = 0
        self._last_telemetry_sequence = None
        self._telemetry_sequence_gaps = 0
        self._telemetry_payload_errors = 0
        self._requested_linear = 0.0
        self._requested_angular = 0.0
        self._last_command_time = None
        self._last_telemetry_time = None
        self._last_command_cycle = time.monotonic()
        self._last_poll_cycle = self._last_command_cycle
        self._last_estop_refresh = 0.0
        self._invalid_command = False
        self._software_estop = bool(self._parameter('start_with_software_estop'))
        self._left_setpoint = 0.0
        self._right_setpoint = 0.0
        self._latest_telemetry = None
        self._closed = False
        self._last_disconnect_count = 0

        if self._mock_hardware:
            self._mock = MockMotorController(
                max_wheel_velocity=config.max_wheel_velocity,
                max_pwm=int(self._parameter('mock_max_pwm')),
                watchdog_timeout=self._firmware_watchdog,
                battery_voltage=float(self._parameter('mock_battery_voltage')),
                ultrasonic_left=float(self._parameter('mock_ultrasonic_left')),
                ultrasonic_right=float(self._parameter('mock_ultrasonic_right')),
            )
            self._transport = None
        else:
            self._mock = None
            self._transport = ReconnectingSerial(
                port=str(self._parameter('serial_port')),
                baud_rate=int(self._parameter('baud_rate')),
                reconnect_interval=float(self._parameter('reconnect_interval_s')),
            )

        # Establish the safe state before the faster telemetry timer can expose
        # controller defaults. Failure is still safe because the firmware
        # watchdog starts expired and the Pi-side latch remains asserted.
        startup_now = time.monotonic()
        self._send(
            protocol.encode_velocity_command(0.0, 0.0, self._next_sequence()),
            startup_now,
        )
        self._send(
            protocol.encode_estop(self._software_estop, self._next_sequence()),
            startup_now,
        )
        self._last_estop_refresh = startup_now

        self._telemetry_publisher = self.create_publisher(
            MotorTelemetry, '/motor/telemetry', 10
        )
        self._battery_publisher = self.create_publisher(BatteryState, '/battery', 10)
        self._left_range_publisher = self.create_publisher(
            Range, '/ultrasonic/front_left', qos_profile_sensor_data
        )
        self._right_range_publisher = self.create_publisher(
            Range, '/ultrasonic/front_right', qos_profile_sensor_data
        )
        self._diagnostic_publisher = self.create_publisher(
            DiagnosticArray, '/diagnostics', 10
        )
        self.create_subscription(Twist, '/cmd_vel', self._on_command, 10)
        self.create_subscription(Bool, '/safety/e_stop', self._on_estop, 10)
        self.create_timer(1.0 / self._command_rate, self._command_cycle)
        self.create_timer(1.0 / self._poll_rate, self._poll_cycle)
        self.create_timer(1.0, self._publish_diagnostics)

        mode = 'mock' if self._mock_hardware else 'serial'
        interlock = 'asserted' if self._software_estop else 'released'
        self.get_logger().info(
            f'Motor-controller bridge started in {mode} mode; '
            f'software e-stop {interlock}; wheel odometry disabled'
        )

    def _parameter(self, name):
        return self.get_parameter(name).value

    def _validate_timing(self):
        values = (
            self._command_rate,
            self._poll_rate,
            self._command_timeout,
            self._telemetry_timeout,
            self._firmware_watchdog,
        )
        if not all(math.isfinite(value) and value > 0.0 for value in values):
            raise ValueError('all bridge rates and timeouts must be finite and positive')
        if self._command_rate < 20.0 or self._poll_rate < 20.0:
            raise ValueError('command and telemetry rates must be at least 20 Hz')
        if self._command_timeout >= self._firmware_watchdog:
            raise ValueError('command_timeout_s must be shorter than firmware watchdog')
        if 1.0 / self._command_rate >= self._firmware_watchdog:
            raise ValueError('command rate is too slow for the firmware watchdog')

    def _on_command(self, message: Twist):
        now = time.monotonic()
        linear = float(message.linear.x)
        angular = float(message.angular.z)
        if not (math.isfinite(linear) and math.isfinite(angular)):
            self._invalid_command = True
            self._last_command_time = now
            self._stop_immediately(now)
            self.get_logger().error('Rejected non-finite /cmd_vel and commanded a stop')
            return
        self._requested_linear = linear
        self._requested_angular = angular
        self._last_command_time = now
        self._invalid_command = False

    def _on_estop(self, message: Bool):
        now = time.monotonic()
        requested = bool(message.data)
        if not requested:
            if not self._mock_hardware and not self._transport.ensure_connected(now):
                self._software_estop = True
                self.get_logger().error(
                    'Cannot release software e-stop while controller is disconnected'
                )
                return
            if not self._controller_contract_ready(now):
                self._software_estop = True
                self.get_logger().error(
                    'Cannot release software e-stop before fresh, valid controller '
                    'telemetry confirms the expected open-loop profile'
                )
                return
        self._software_estop = requested
        if self._software_estop:
            self._stop_immediately(now)
        self._send(protocol.encode_estop(self._software_estop, self._next_sequence()), now)
        self._last_estop_refresh = now

    def _next_sequence(self) -> int:
        sequence = self._command_sequence
        self._command_sequence = (self._command_sequence + 1) & 0xFFFF
        return sequence

    def _command_is_stale(self, now: float) -> bool:
        return (
            self._last_command_time is None
            or now - self._last_command_time > self._command_timeout
        )

    def _controller_contract_ready(self, now: float) -> bool:
        if (
            self._latest_telemetry is None
            or self._last_telemetry_time is None
            or now - self._last_telemetry_time > self._telemetry_timeout
            or not self._latest_telemetry.configuration_valid
        ):
            return False
        return not (
            self._require_open_loop and not self._latest_telemetry.open_loop_mode
        )

    def _command_cycle(self):
        now = time.monotonic()
        dt = max(1.0e-4, min(0.25, now - self._last_command_cycle))
        self._last_command_cycle = now
        if (
            self._software_estop
            or self._invalid_command
            or self._command_is_stale(now)
            or not self._controller_contract_ready(now)
        ):
            self._left_setpoint, self._right_setpoint = self._limiter.reset()
        else:
            self._left_setpoint, self._right_setpoint = self._limiter.step(
                self._requested_linear, self._requested_angular, dt
            )
        frame = protocol.encode_velocity_command(
            self._left_setpoint, self._right_setpoint, self._next_sequence()
        )
        if not self._send(frame, now):
            self._latch_transport_fault()
            return
        if now - self._last_estop_refresh >= 1.0:
            self._send(
                protocol.encode_estop(self._software_estop, self._next_sequence()), now
            )
            self._last_estop_refresh = now

    def _stop_immediately(self, now: float):
        self._left_setpoint, self._right_setpoint = self._limiter.reset()
        self._send(
            protocol.encode_velocity_command(0.0, 0.0, self._next_sequence()), now
        )

    def _send(self, data: bytes, now: float) -> bool:
        if self._mock_hardware:
            self._mock.receive(data, now)
            return True
        return self._transport.write(data, now)

    def _latch_transport_fault(self):
        if not self._software_estop:
            self.get_logger().error(
                'Controller transport lost; software e-stop latched'
            )
        self._software_estop = True
        self._left_setpoint, self._right_setpoint = self._limiter.reset()

    def _poll_cycle(self):
        now = time.monotonic()
        if self._mock_hardware:
            dt = max(1.0e-4, min(0.25, now - self._last_poll_cycle))
            data = self._mock.exchange(b'', dt, now)
        else:
            data = self._transport.read(now)
            if self._transport.disconnect_count > self._last_disconnect_count:
                self._last_disconnect_count = self._transport.disconnect_count
                self._latch_transport_fault()
        self._last_poll_cycle = now
        for frame in self._parser.feed(data):
            if frame.message_id != protocol.MSG_TELEMETRY:
                continue
            try:
                telemetry = protocol.decode_telemetry(frame.payload)
            except ValueError:
                self._telemetry_payload_errors += 1
                continue
            self._track_telemetry_sequence(frame.sequence)
            self._last_telemetry_time = now
            self._latch_controller_estop(telemetry, now)
            self._latest_telemetry = telemetry
            self._publish_telemetry(telemetry)

    def _latch_controller_estop(self, telemetry: protocol.Telemetry, now: float):
        """Require an explicit Pi-side reset after any controller e-stop event."""
        if not telemetry.estop_active or self._software_estop:
            return
        self._software_estop = True
        self._stop_immediately(now)
        self._send(protocol.encode_estop(True, self._next_sequence()), now)
        self._last_estop_refresh = now
        self.get_logger().warning(
            'Controller e-stop latched; clear hardware stop, then explicitly '
            'release software e-stop'
        )

    def _track_telemetry_sequence(self, sequence: int):
        if self._last_telemetry_sequence is not None:
            expected = (self._last_telemetry_sequence + 1) & 0xFFFF
            gap = (sequence - expected) & 0xFFFF
            if 0 < gap < 0x8000:
                self._telemetry_sequence_gaps += gap
        self._last_telemetry_sequence = sequence

    def _transport_connected(self) -> bool:
        return self._mock_hardware or self._transport.connected

    def _publish_telemetry(self, telemetry: protocol.Telemetry):
        stamp = self.get_clock().now().to_msg()
        message = MotorTelemetry()
        message.header.stamp = stamp
        message.header.frame_id = self._base_frame
        message.left_velocity = telemetry.left_velocity
        message.right_velocity = telemetry.right_velocity
        message.left_setpoint = self._left_setpoint
        message.right_setpoint = self._right_setpoint
        message.left_pwm = telemetry.left_pwm
        message.right_pwm = telemetry.right_pwm
        message.left_ticks = telemetry.left_ticks
        message.right_ticks = telemetry.right_ticks
        message.battery_voltage = telemetry.battery_voltage
        message.ultrasonic_left = telemetry.ultrasonic_left
        message.ultrasonic_right = telemetry.ultrasonic_right
        message.estop_active = telemetry.estop_active
        message.watchdog_triggered = telemetry.watchdog_triggered
        message.configuration_valid = telemetry.configuration_valid
        message.open_loop_mode = telemetry.open_loop_mode
        message.wheel_feedback_valid = not telemetry.open_loop_mode
        message.serial_connected = self._transport_connected()
        message.acknowledged_command_sequence = telemetry.acknowledged_command_sequence
        message.command_age = telemetry.command_age_ms / 1000.0
        message.rx_crc_errors = telemetry.rx_crc_errors
        self._telemetry_publisher.publish(message)
        self._publish_battery(telemetry, stamp)
        self._publish_range(
            self._left_range_publisher,
            telemetry.ultrasonic_left,
            self._left_range_frame,
            stamp,
        )
        self._publish_range(
            self._right_range_publisher,
            telemetry.ultrasonic_right,
            self._right_range_frame,
            stamp,
        )

    def _publish_battery(self, telemetry: protocol.Telemetry, stamp):
        battery = BatteryState()
        battery.header.stamp = stamp
        battery.header.frame_id = self._base_frame
        battery.voltage = telemetry.battery_voltage
        battery.percentage = math.nan
        battery.power_supply_status = BatteryState.POWER_SUPPLY_STATUS_UNKNOWN
        battery.power_supply_health = BatteryState.POWER_SUPPLY_HEALTH_UNKNOWN
        battery.power_supply_technology = BatteryState.POWER_SUPPLY_TECHNOLOGY_UNKNOWN
        battery.present = telemetry.battery_voltage > 0.0
        battery.location = 'ugv_main_battery'
        self._battery_publisher.publish(battery)

    def _publish_range(self, publisher, value: float, frame: str, stamp):
        message = Range()
        message.header.stamp = stamp
        message.header.frame_id = frame
        message.radiation_type = Range.ULTRASOUND
        message.field_of_view = self._range_fov
        message.min_range = self._range_min
        message.max_range = self._range_max
        message.range = value if value >= 0.0 else math.nan
        publisher.publish(message)

    @staticmethod
    def _diagnostic(name: str, level: int, message: str, values) -> DiagnosticStatus:
        status = DiagnosticStatus()
        status.name = name
        status.hardware_id = 'nodemcu_esp8266_motor_controller'
        status.level = level
        status.message = message
        status.values = [KeyValue(key=str(key), value=str(value)) for key, value in values]
        return status

    def _publish_diagnostics(self):
        now = time.monotonic()
        connected = self._transport_connected()
        telemetry_stale = (
            self._last_telemetry_time is None
            or now - self._last_telemetry_time > self._telemetry_timeout
        )
        command_stale = self._command_is_stale(now)
        transport_level = DiagnosticStatus.OK
        transport_message = 'connected'
        if not connected:
            transport_level = DiagnosticStatus.ERROR
            transport_message = 'serial disconnected'
        elif telemetry_stale:
            transport_level = DiagnosticStatus.ERROR
            transport_message = 'telemetry stale'
        transport_values = [
            ('connected', connected),
            ('telemetry_stale', telemetry_stale),
            ('bridge_crc_errors', self._parser.crc_errors),
            ('bridge_version_errors', self._parser.version_errors),
            ('bridge_payload_errors', self._telemetry_payload_errors),
            ('telemetry_sequence_gaps', self._telemetry_sequence_gaps),
        ]
        if self._transport is not None:
            transport_values.extend([
                ('connections', self._transport.connection_count),
                ('disconnects', self._transport.disconnect_count),
                ('last_error', self._transport.last_error),
            ])

        command_level = DiagnosticStatus.OK
        command_message = 'motion command healthy'
        if self._software_estop:
            command_level = DiagnosticStatus.ERROR
            command_message = 'software e-stop active'
        elif self._invalid_command:
            command_level = DiagnosticStatus.ERROR
            command_message = 'invalid motion command rejected'
        elif command_stale:
            command_level = DiagnosticStatus.WARN
            command_message = 'motion command stale; output zero'

        controller_level = DiagnosticStatus.STALE
        controller_message = 'no telemetry'
        controller_values = []
        if self._latest_telemetry is not None:
            telemetry = self._latest_telemetry
            controller_level = DiagnosticStatus.OK
            controller_message = 'controller ready'
            if not telemetry.configuration_valid:
                controller_level = DiagnosticStatus.ERROR
                controller_message = 'firmware configuration invalid; propulsion disabled'
            elif telemetry.estop_active:
                controller_level = DiagnosticStatus.ERROR
                controller_message = 'motor controller e-stop active'
            elif telemetry.watchdog_triggered:
                controller_level = DiagnosticStatus.ERROR
                controller_message = 'motor controller watchdog stopped propulsion'
            elif self._require_open_loop and not telemetry.open_loop_mode:
                controller_level = DiagnosticStatus.ERROR
                controller_message = 'unexpected controller mode; open-loop required'
            elif telemetry.open_loop_mode:
                controller_level = DiagnosticStatus.WARN
                controller_message = 'controller ready; wheel feedback unavailable'
            controller_values = [
                ('configuration_valid', telemetry.configuration_valid),
                ('estop_active', telemetry.estop_active),
                ('watchdog_triggered', telemetry.watchdog_triggered),
                ('open_loop_mode', telemetry.open_loop_mode),
                ('wheel_feedback_valid', not telemetry.open_loop_mode),
                ('firmware_rx_crc_errors', telemetry.rx_crc_errors),
                ('command_age_ms', telemetry.command_age_ms),
            ]

        message = DiagnosticArray()
        message.header.stamp = self.get_clock().now().to_msg()
        message.status = [
            self._diagnostic(
                'navigen/motor_controller_transport',
                transport_level,
                transport_message,
                transport_values,
            ),
            self._diagnostic(
                'navigen/motion_command',
                command_level,
                command_message,
                [
                    ('stale', command_stale),
                    ('invalid', self._invalid_command),
                    ('software_estop', self._software_estop),
                    ('left_setpoint_mps', self._left_setpoint),
                    ('right_setpoint_mps', self._right_setpoint),
                ],
            ),
            self._diagnostic(
                'navigen/motor_controller',
                controller_level,
                controller_message,
                controller_values,
            ),
        ]
        self._diagnostic_publisher.publish(message)

    def shutdown(self):
        if self._closed:
            return
        self._closed = True
        now = time.monotonic()
        try:
            self._software_estop = True
            self._left_setpoint, self._right_setpoint = self._limiter.reset()
            self._send(
                protocol.encode_velocity_command(0.0, 0.0, self._next_sequence()), now
            )
            self._send(protocol.encode_estop(True, self._next_sequence()), now)
        finally:
            if self._transport is not None:
                self._transport.close()


def main(args=None):
    rclpy.init(args=args)
    node = None
    try:
        node = MotorControllerBridge()
        rclpy.spin(node)
    except (ValueError, RuntimeError) as error:
        if node is not None:
            node.get_logger().fatal(str(error))
        else:
            print(f'motor_controller_bridge configuration error: {error}')
        raise
    except KeyboardInterrupt:
        pass
    finally:
        if node is not None:
            node.shutdown()
            node.destroy_node()
        if rclpy.ok():
            rclpy.shutdown()


if __name__ == '__main__':
    main()
