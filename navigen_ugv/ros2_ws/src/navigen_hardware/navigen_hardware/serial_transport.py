"""Reconnect-capable non-blocking serial transport, isolated from ROS for tests."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any


class ReconnectingSerial:
    """Open on demand and recover from unplug/read/write failures."""

    def __init__(
        self,
        port: str,
        baud_rate: int,
        reconnect_interval: float,
        serial_factory: Callable[..., Any] | None = None,
    ):
        if not port:
            raise ValueError('serial port must not be empty')
        if baud_rate <= 0:
            raise ValueError('baud_rate must be positive')
        if reconnect_interval <= 0.0:
            raise ValueError('reconnect_interval must be positive')
        if serial_factory is None:
            import serial

            serial_factory = serial.Serial
        self.port = port
        self.baud_rate = baud_rate
        self.reconnect_interval = reconnect_interval
        self.serial_factory = serial_factory
        self.handle = None
        self.next_attempt = 0.0
        self.connection_count = 0
        self.disconnect_count = 0
        self.last_error = ''

    @property
    def connected(self) -> bool:
        return self.handle is not None

    def ensure_connected(self, now: float) -> bool:
        if self.connected:
            return True
        if now < self.next_attempt:
            return False
        try:
            self.handle = self.serial_factory(
                port=self.port,
                baudrate=self.baud_rate,
                timeout=0,
                write_timeout=0,
            )
            self.connection_count += 1
            self.last_error = ''
            return True
        except Exception as error:  # serial backends expose several OS-specific errors
            self.last_error = str(error)
            self.next_attempt = now + self.reconnect_interval
            self.handle = None
            return False

    def _disconnect(self, now: float, error: Exception) -> None:
        self.last_error = str(error)
        if self.handle is not None:
            try:
                self.handle.close()
            except Exception:
                pass
        self.handle = None
        self.disconnect_count += 1
        self.next_attempt = now + self.reconnect_interval

    def write(self, data: bytes, now: float) -> bool:
        if not self.ensure_connected(now):
            return False
        try:
            written = int(self.handle.write(data))
            if written != len(data):
                raise OSError(f'partial serial write: {written}/{len(data)} bytes')
            return True
        except Exception as error:
            self._disconnect(now, error)
            return False

    def read(self, now: float, maximum: int = 256) -> bytes:
        if maximum <= 0:
            raise ValueError('maximum read size must be positive')
        if not self.ensure_connected(now):
            return b''
        try:
            available = int(getattr(self.handle, 'in_waiting', 0))
            if available <= 0:
                return b''
            return bytes(self.handle.read(min(maximum, available)))
        except Exception as error:
            self._disconnect(now, error)
            return b''

    def close(self) -> None:
        if self.handle is not None:
            try:
                self.handle.close()
            finally:
                self.handle = None
