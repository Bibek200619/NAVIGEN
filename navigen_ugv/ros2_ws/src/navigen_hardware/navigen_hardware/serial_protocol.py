"""Versioned framed serial protocol shared conceptually with the ESP32 firmware."""

from __future__ import annotations

from dataclasses import dataclass
import math
import struct


SYNC = b'\xaa\x55'
PROTOCOL_VERSION = 1
MAX_PAYLOAD_SIZE = 64

MSG_CMD_VELOCITY = 0x01
MSG_CMD_ESTOP = 0x02
MSG_TELEMETRY = 0x10

FLAG_ESTOP = 0x01
FLAG_WATCHDOG = 0x02
FLAG_CONFIG_INVALID = 0x04
US_INVALID = 0xFFFF

_HEADER_STRUCT = struct.Struct('<BBHB')
_VELOCITY_STRUCT = struct.Struct('<hh')
_TELEMETRY_STRUCT = struct.Struct('<hhhhiiHHHBHHH')


def crc8(data: bytes) -> int:
    """CRC-8/ATM (polynomial 0x07, initial value 0x00)."""
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc


def _uint16(value: int) -> int:
    return int(value) & 0xFFFF


def _mm_per_second(value: float) -> int:
    if not math.isfinite(value):
        raise ValueError('velocity must be finite')
    return max(-32768, min(32767, int(round(value * 1000.0))))


def _millimetres(value: float) -> int:
    if not math.isfinite(value) or value < 0.0:
        return US_INVALID
    return min(US_INVALID - 1, int(round(value * 1000.0)))


@dataclass(frozen=True)
class Frame:
    message_id: int
    sequence: int
    payload: bytes


def encode_frame(message_id: int, sequence: int, payload: bytes = b'') -> bytes:
    if not 0 <= message_id <= 0xFF:
        raise ValueError('message_id must fit in uint8')
    if len(payload) > MAX_PAYLOAD_SIZE:
        raise ValueError(f'payload exceeds {MAX_PAYLOAD_SIZE} bytes')
    header = _HEADER_STRUCT.pack(
        PROTOCOL_VERSION, message_id, _uint16(sequence), len(payload)
    )
    body = header + payload
    return SYNC + body + bytes((crc8(body),))


def encode_velocity_command(left: float, right: float, sequence: int) -> bytes:
    payload = _VELOCITY_STRUCT.pack(
        _mm_per_second(left), _mm_per_second(right)
    )
    return encode_frame(MSG_CMD_VELOCITY, sequence, payload)


def decode_velocity_command(payload: bytes) -> tuple[float, float]:
    if len(payload) != _VELOCITY_STRUCT.size:
        raise ValueError('velocity command payload has wrong size')
    left, right = _VELOCITY_STRUCT.unpack(payload)
    return left / 1000.0, right / 1000.0


def encode_estop(active: bool, sequence: int) -> bytes:
    return encode_frame(MSG_CMD_ESTOP, sequence, bytes((1 if active else 0,)))


def decode_estop(payload: bytes) -> bool:
    if len(payload) != 1 or payload[0] not in (0, 1):
        raise ValueError('e-stop payload must be one boolean byte')
    return bool(payload[0])


@dataclass(frozen=True)
class Telemetry:
    left_velocity: float
    right_velocity: float
    left_pwm: int
    right_pwm: int
    left_ticks: int
    right_ticks: int
    battery_voltage: float
    ultrasonic_left: float
    ultrasonic_right: float
    estop_active: bool
    watchdog_triggered: bool
    configuration_valid: bool
    acknowledged_command_sequence: int
    command_age_ms: int
    rx_crc_errors: int


def encode_telemetry(telemetry: Telemetry, sequence: int) -> bytes:
    """Encode telemetry for golden-vector tests and the mock ESP32."""
    flags = 0
    if telemetry.estop_active:
        flags |= FLAG_ESTOP
    if telemetry.watchdog_triggered:
        flags |= FLAG_WATCHDOG
    if not telemetry.configuration_valid:
        flags |= FLAG_CONFIG_INVALID
    battery_mv = max(
        0, min(0xFFFF, int(round(telemetry.battery_voltage * 1000.0)))
    )
    payload = _TELEMETRY_STRUCT.pack(
        _mm_per_second(telemetry.left_velocity),
        _mm_per_second(telemetry.right_velocity),
        max(-32768, min(32767, int(telemetry.left_pwm))),
        max(-32768, min(32767, int(telemetry.right_pwm))),
        max(-(2**31), min(2**31 - 1, int(telemetry.left_ticks))),
        max(-(2**31), min(2**31 - 1, int(telemetry.right_ticks))),
        battery_mv,
        _millimetres(telemetry.ultrasonic_left),
        _millimetres(telemetry.ultrasonic_right),
        flags,
        _uint16(telemetry.acknowledged_command_sequence),
        min(0xFFFF, max(0, int(telemetry.command_age_ms))),
        min(0xFFFF, max(0, int(telemetry.rx_crc_errors))),
    )
    return encode_frame(MSG_TELEMETRY, sequence, payload)


def decode_telemetry(payload: bytes) -> Telemetry:
    if len(payload) != _TELEMETRY_STRUCT.size:
        raise ValueError('telemetry payload has wrong size')
    (
        left_velocity,
        right_velocity,
        left_pwm,
        right_pwm,
        left_ticks,
        right_ticks,
        battery_mv,
        ultrasonic_left,
        ultrasonic_right,
        flags,
        acknowledged_sequence,
        command_age_ms,
        rx_crc_errors,
    ) = _TELEMETRY_STRUCT.unpack(payload)
    return Telemetry(
        left_velocity=left_velocity / 1000.0,
        right_velocity=right_velocity / 1000.0,
        left_pwm=left_pwm,
        right_pwm=right_pwm,
        left_ticks=left_ticks,
        right_ticks=right_ticks,
        battery_voltage=battery_mv / 1000.0,
        ultrasonic_left=(
            -1.0 if ultrasonic_left == US_INVALID else ultrasonic_left / 1000.0
        ),
        ultrasonic_right=(
            -1.0 if ultrasonic_right == US_INVALID else ultrasonic_right / 1000.0
        ),
        estop_active=bool(flags & FLAG_ESTOP),
        watchdog_triggered=bool(flags & FLAG_WATCHDOG),
        configuration_valid=not bool(flags & FLAG_CONFIG_INVALID),
        acknowledged_command_sequence=acknowledged_sequence,
        command_age_ms=command_age_ms,
        rx_crc_errors=rx_crc_errors,
    )


class FrameParser:
    """Bounded incremental parser that rejects bad CRC, version, and length."""

    def __init__(self):
        self._buffer = bytearray()
        self.crc_errors = 0
        self.version_errors = 0
        self.length_errors = 0
        self.discarded_bytes = 0

    def feed(self, data: bytes) -> list[Frame]:
        self._buffer.extend(data)
        frames = []
        minimum_frame_size = len(SYNC) + _HEADER_STRUCT.size + 1
        while True:
            start = self._buffer.find(SYNC)
            if start < 0:
                keep = 1 if self._buffer.endswith(SYNC[:1]) else 0
                discard = len(self._buffer) - keep
                self.discarded_bytes += discard
                if discard:
                    del self._buffer[:discard]
                break
            if start:
                self.discarded_bytes += start
                del self._buffer[:start]
            if len(self._buffer) < minimum_frame_size:
                break

            version, message_id, sequence, payload_size = _HEADER_STRUCT.unpack_from(
                self._buffer, len(SYNC)
            )
            if payload_size > MAX_PAYLOAD_SIZE:
                self.length_errors += 1
                self.discarded_bytes += 1
                del self._buffer[0]
                continue

            total_size = minimum_frame_size + payload_size
            if len(self._buffer) < total_size:
                break
            body_end = len(SYNC) + _HEADER_STRUCT.size + payload_size
            body = bytes(self._buffer[len(SYNC):body_end])
            received_crc = self._buffer[body_end]
            if crc8(body) != received_crc:
                self.crc_errors += 1
                self.discarded_bytes += 1
                del self._buffer[0]
                continue

            payload = bytes(
                self._buffer[
                    len(SYNC) + _HEADER_STRUCT.size:body_end
                ]
            )
            del self._buffer[:total_size]
            if version != PROTOCOL_VERSION:
                self.version_errors += 1
                continue
            frames.append(Frame(message_id, sequence, payload))
        return frames
