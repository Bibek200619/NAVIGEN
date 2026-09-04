import pytest

from navigen_hardware import serial_protocol as protocol
from navigen_hardware.mock_motor_controller import MockMotorController


def decode_exchange(mock, outbound, dt, now):
    inbound = mock.exchange(outbound, dt=dt, now=now)
    [frame] = protocol.FrameParser().feed(inbound)
    return protocol.decode_telemetry(frame.payload)


def test_mock_tracks_command_then_watchdog_stops() -> None:
    mock = MockMotorController(0.6, 255, watchdog_timeout=0.3)
    moving = decode_exchange(
        mock,
        protocol.encode_velocity_command(0.2, 0.3, sequence=7),
        dt=0.1,
        now=1.0,
    )
    assert moving.left_velocity == 0.0
    assert moving.right_velocity == 0.0
    assert moving.left_pwm > 0
    assert moving.right_pwm > moving.left_pwm
    assert moving.left_ticks == moving.right_ticks == 0
    assert moving.open_loop_mode is True
    assert moving.watchdog_triggered is False
    assert moving.acknowledged_command_sequence == 7
    stopped = mock.step(dt=0.31, now=1.31)
    assert stopped.watchdog_triggered is True
    assert stopped.left_pwm == stopped.right_pwm == 0


def test_mock_estop_overrides_and_can_be_released() -> None:
    mock = MockMotorController(0.6, 255, watchdog_timeout=0.3)
    mock.receive(protocol.encode_velocity_command(0.2, 0.2, 1), now=0.0)
    mock.receive(protocol.encode_estop(True, 2), now=0.01)
    assert mock.step(0.02, 0.02).estop_active is True
    assert mock.applied_pwm == (0, 0)

    mock.receive(protocol.encode_estop(False, 3), now=0.03)
    mock.receive(protocol.encode_velocity_command(0.1, 0.1, 4), now=0.03)
    released = mock.step(0.02, 0.04)
    assert released.estop_active is False
    assert released.left_pwm > 0
