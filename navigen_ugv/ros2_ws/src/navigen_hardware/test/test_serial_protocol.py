import pytest

from navigen_hardware import serial_protocol as protocol


def make_telemetry(**overrides) -> protocol.Telemetry:
    values = {
        'left_velocity': 0.25,
        'right_velocity': -0.25,
        'left_pwm': 120,
        'right_pwm': -120,
        'left_ticks': 12345,
        'right_ticks': -6789,
        'battery_voltage': 11.7,
        'ultrasonic_left': 1.234,
        'ultrasonic_right': -1.0,
        'estop_active': False,
        'watchdog_triggered': True,
        'configuration_valid': True,
        'acknowledged_command_sequence': 0x1234,
        'command_age_ms': 42,
        'rx_crc_errors': 3,
    }
    values.update(overrides)
    return protocol.Telemetry(**values)


def test_velocity_command_golden_vector_and_decode() -> None:
    frame = protocol.encode_velocity_command(0.25, -0.25, 0x1234)
    assert frame.hex() == 'aa550101341204fa0006ff3c'
    parsed = protocol.FrameParser().feed(frame)
    assert len(parsed) == 1
    assert parsed[0].message_id == protocol.MSG_CMD_VELOCITY
    assert parsed[0].sequence == 0x1234
    assert protocol.decode_velocity_command(parsed[0].payload) == pytest.approx(
        (0.25, -0.25)
    )


def test_telemetry_round_trip_and_invalid_ultrasonic() -> None:
    parser = protocol.FrameParser()
    [frame] = parser.feed(protocol.encode_telemetry(make_telemetry(), sequence=9))
    telemetry = protocol.decode_telemetry(frame.payload)
    assert frame.sequence == 9
    assert telemetry.left_velocity == pytest.approx(0.25)
    assert telemetry.right_velocity == pytest.approx(-0.25)
    assert telemetry.left_ticks == 12345
    assert telemetry.right_ticks == -6789
    assert telemetry.battery_voltage == pytest.approx(11.7)
    assert telemetry.ultrasonic_left == pytest.approx(1.234)
    assert telemetry.ultrasonic_right == -1.0
    assert telemetry.watchdog_triggered is True
    assert telemetry.configuration_valid is True
    assert telemetry.acknowledged_command_sequence == 0x1234
    assert telemetry.command_age_ms == 42
    assert telemetry.rx_crc_errors == 3


def test_partial_noise_crc_rejection_and_resynchronization() -> None:
    good = protocol.encode_telemetry(make_telemetry(), sequence=4)
    bad = bytearray(good)
    bad[12] ^= 0xFF
    parser = protocol.FrameParser()
    assert parser.feed(b'noise\xaa' + bytes(bad[:8])) == []
    assert parser.feed(bytes(bad[8:]) + good[:7]) == []
    [frame] = parser.feed(good[7:])
    assert frame.sequence == 4
    assert parser.crc_errors == 1
    assert parser.discarded_bytes >= 6


def test_bad_length_and_protocol_version_are_rejected() -> None:
    parser = protocol.FrameParser()
    bad_length = protocol.SYNC + bytes((1, protocol.MSG_TELEMETRY, 0, 0, 65))
    good = protocol.encode_estop(True, sequence=2)
    frames = parser.feed(bad_length + good)
    assert len(frames) == 1
    assert parser.length_errors == 1

    body = bytes((99, protocol.MSG_CMD_ESTOP, 3, 0, 1, 1))
    wrong_version = protocol.SYNC + body + bytes((protocol.crc8(body),))
    assert parser.feed(wrong_version) == []
    assert parser.version_errors == 1


def test_payload_validation_and_non_finite_velocity() -> None:
    with pytest.raises(ValueError):
        protocol.encode_frame(1, 0, bytes(protocol.MAX_PAYLOAD_SIZE + 1))
    with pytest.raises(ValueError):
        protocol.encode_velocity_command(float('nan'), 0.0, 0)
    with pytest.raises(ValueError):
        protocol.decode_estop(b'\x02')
    with pytest.raises(ValueError):
        protocol.decode_telemetry(b'\x00')
