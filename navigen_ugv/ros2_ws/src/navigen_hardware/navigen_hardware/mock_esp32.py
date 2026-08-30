"""Deterministic protocol-level ESP32 emulator for hardware-free integration tests."""

from __future__ import annotations

import math

from navigen_hardware import serial_protocol as protocol


class MockEsp32:
    """Emulate command parsing, e-stop, watchdog, encoders, and telemetry."""

    def __init__(
        self,
        wheel_radius: float,
        ticks_per_revolution: float,
        watchdog_timeout: float,
        battery_voltage: float = 12.0,
        ultrasonic_left: float = 2.5,
        ultrasonic_right: float = 2.5,
    ):
        if (
            wheel_radius <= 0.0
            or ticks_per_revolution <= 0.0
            or watchdog_timeout <= 0.0
            or battery_voltage < 0.0
        ):
            raise ValueError('mock geometry and watchdog timeout must be positive')
        self.wheel_radius = wheel_radius
        self.ticks_per_revolution = ticks_per_revolution
        self.watchdog_timeout = watchdog_timeout
        self.battery_voltage = battery_voltage
        self.ultrasonic_left = ultrasonic_left
        self.ultrasonic_right = ultrasonic_right
        self.parser = protocol.FrameParser()
        self.target = (0.0, 0.0)
        self.velocity = (0.0, 0.0)
        self.distance = [0.0, 0.0]
        self.software_estop = False
        self.hardware_estop = False
        self.last_velocity_time = None
        self.last_command_sequence = 0
        self.telemetry_sequence = 0

    def receive(self, data: bytes, now: float) -> None:
        for frame in self.parser.feed(data):
            if frame.message_id == protocol.MSG_CMD_VELOCITY:
                try:
                    self.target = protocol.decode_velocity_command(frame.payload)
                except ValueError:
                    continue
                self.last_velocity_time = now
                self.last_command_sequence = frame.sequence
            elif frame.message_id == protocol.MSG_CMD_ESTOP:
                try:
                    self.software_estop = protocol.decode_estop(frame.payload)
                except ValueError:
                    continue
                self.last_command_sequence = frame.sequence

    def step(self, dt: float, now: float) -> protocol.Telemetry:
        if dt <= 0.0:
            raise ValueError('mock timestep must be positive')
        watchdog = (
            self.last_velocity_time is None
            or now - self.last_velocity_time > self.watchdog_timeout
        )
        stopped = watchdog or self.software_estop or self.hardware_estop
        self.velocity = (0.0, 0.0) if stopped else self.target
        for index, velocity in enumerate(self.velocity):
            self.distance[index] += velocity * dt

        circumference = 2.0 * math.pi * self.wheel_radius
        ticks_per_metre = (
            self.ticks_per_revolution / circumference
            if self.ticks_per_revolution > 0.0
            else 0.0
        )
        command_age_ms = (
            0xFFFF
            if self.last_velocity_time is None
            else min(0xFFFF, int(max(0.0, now - self.last_velocity_time) * 1000.0))
        )
        return protocol.Telemetry(
            left_velocity=self.velocity[0],
            right_velocity=self.velocity[1],
            left_pwm=0,
            right_pwm=0,
            left_ticks=int(round(self.distance[0] * ticks_per_metre)),
            right_ticks=int(round(self.distance[1] * ticks_per_metre)),
            battery_voltage=self.battery_voltage,
            ultrasonic_left=self.ultrasonic_left,
            ultrasonic_right=self.ultrasonic_right,
            estop_active=self.software_estop or self.hardware_estop,
            watchdog_triggered=watchdog,
            configuration_valid=True,
            acknowledged_command_sequence=self.last_command_sequence,
            command_age_ms=command_age_ms,
            rx_crc_errors=self.parser.crc_errors,
        )

    def exchange(self, data: bytes, dt: float, now: float) -> bytes:
        self.receive(data, now)
        telemetry = self.step(dt, now)
        frame = protocol.encode_telemetry(telemetry, self.telemetry_sequence)
        self.telemetry_sequence = (self.telemetry_sequence + 1) & 0xFFFF
        return frame
