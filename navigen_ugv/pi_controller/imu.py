"""Optional MPU-6050/6500 readings from Pi I2C; never used to arm motors."""
import math
import struct
import threading
import time

SUPPORTED_IDS={0x68:'MPU-6050',0x70:'MPU-6500'}


def decode_sample(data):
    if len(data) != 14:
        raise ValueError('MPU sample must contain 14 bytes')
    ax,ay,az,_,gx,gy,gz=struct.unpack('>hhhhhhh',bytes(data))
    ax,ay,az=(value/16384.0 for value in (ax,ay,az))
    gx,gy,gz=(value/131.0 for value in (gx,gy,gz))
    return dict(accel_x_g=ax,accel_y_g=ay,accel_z_g=az,
                gyro_x_dps=gx,gyro_y_dps=gy,gyro_z_dps=gz,
                roll_deg=math.degrees(math.atan2(ay,az)),
                pitch_deg=math.degrees(math.atan2(-ax,math.hypot(ay,az))))


class Imu:
    def __init__(self,bus_number=1,address=0x68,bus_factory=None):
        if not 0 <= bus_number <= 255 or address not in (0x68,0x69):
            raise ValueError('MPU-6050 needs an I2C bus and address 0x68 or 0x69')
        self.bus_number=bus_number
        self.address=address
        self.bus_factory=bus_factory or self._open_bus
        self.lock=threading.Lock()
        self.sample=None
        self.sample_time=None
        self.model=None
        self.error='Waiting for MPU sensor'

    def _open_bus(self):
        from smbus2 import SMBus
        return SMBus(self.bus_number)

    def status(self):
        with self.lock:
            age=None if self.sample_time is None else max(0,int((time.monotonic()-self.sample_time)*1000))
            available=self.sample is not None and age is not None and age<=500
            return dict(available=available,address=hex(self.address),model=self.model,age_ms=age,
                        sample=self.sample.copy() if available else None,
                        error='' if available else self.error or 'Stale MPU sample')

    def run(self,stop_event):
        while not stop_event.is_set():
            bus=None
            try:
                bus=self.bus_factory()
                who=bus.read_byte_data(self.address,0x75)
                if who not in SUPPORTED_IDS:
                    raise ValueError(f'Unsupported MPU identity 0x{who:02x}')
                with self.lock:
                    self.model=SUPPORTED_IDS[who]
                bus.write_byte_data(self.address,0x6B,0x01)  # wake; gyro X reference clock
                bus.write_byte_data(self.address,0x1B,0x00)  # gyro ±250 deg/s
                bus.write_byte_data(self.address,0x1C,0x00)  # accel ±2 g
                while not stop_event.is_set():
                    sample=decode_sample(bus.read_i2c_block_data(self.address,0x3B,14))
                    with self.lock:
                        self.sample=sample
                        self.sample_time=time.monotonic()
                        self.error=''
                    stop_event.wait(0.05)
            except Exception as error:
                with self.lock:
                    self.sample=None
                    self.sample_time=None
                    self.model=None
                    self.error=str(error)
            finally:
                if bus is not None:
                    try:
                        bus.close()
                    except Exception:
                        pass
            if not stop_event.is_set():
                stop_event.wait(1.0)
