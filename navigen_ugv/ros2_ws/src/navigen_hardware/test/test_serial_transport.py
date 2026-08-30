from navigen_hardware.serial_transport import ReconnectingSerial


class FakePort:
    def __init__(self, fail_write=False):
        self.fail_write = fail_write
        self.closed = False
        self.written = []
        self.incoming = bytearray()

    @property
    def in_waiting(self):
        return len(self.incoming)

    def write(self, data):
        if self.fail_write:
            raise OSError('cable unplugged')
        self.written.append(bytes(data))
        return len(data)

    def read(self, size):
        result = bytes(self.incoming[:size])
        del self.incoming[:size]
        return result

    def close(self):
        self.closed = True


def test_connect_write_read_and_close() -> None:
    port = FakePort()
    transport = ReconnectingSerial('/dev/fake', 115200, 1.0, lambda **_: port)
    assert transport.write(b'command', now=0.0)
    assert port.written == [b'command']
    port.incoming.extend(b'telemetry')
    assert transport.read(now=0.1, maximum=4) == b'tele'
    transport.close()
    assert port.closed
    assert not transport.connected


def test_failed_open_is_rate_limited_then_recovers() -> None:
    attempts = []
    good_port = FakePort()

    def factory(**_):
        attempts.append(True)
        if len(attempts) < 2:
            raise OSError('missing device')
        return good_port

    transport = ReconnectingSerial('/dev/fake', 115200, 1.0, factory)
    assert not transport.write(b'x', now=0.0)
    assert not transport.write(b'x', now=0.5)
    assert len(attempts) == 1
    assert transport.write(b'x', now=1.0)
    assert len(attempts) == 2
    assert transport.connection_count == 1


def test_write_failure_disconnects_and_reconnects() -> None:
    ports = [FakePort(fail_write=True), FakePort()]
    transport = ReconnectingSerial(
        '/dev/fake', 115200, 0.5, lambda **_: ports.pop(0)
    )
    assert not transport.write(b'first', now=0.0)
    assert transport.disconnect_count == 1
    assert not transport.write(b'early', now=0.25)
    assert transport.write(b'recovered', now=0.5)
    assert transport.connected


def test_partial_write_is_treated_as_disconnect() -> None:
    port = FakePort()
    port.write = lambda data: len(data) - 1
    transport = ReconnectingSerial('/dev/fake', 115200, 1.0, lambda **_: port)
    assert not transport.write(b'command', now=0.0)
    assert not transport.connected
    assert transport.disconnect_count == 1
    assert 'partial serial write' in transport.last_error
