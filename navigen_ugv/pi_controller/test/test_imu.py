import struct

import pytest

from pi_controller.imu import Imu,decode_sample


def test_mpu6050_sample_uses_configured_full_scale():
    raw=struct.pack('>hhhhhhh',0,0,16384,0,0,0,131)
    sample=decode_sample(raw)
    assert sample['accel_z_g']==pytest.approx(1.0)
    assert sample['gyro_z_dps']==pytest.approx(1.0)
    assert sample['roll_deg']==pytest.approx(0.0)
    assert sample['pitch_deg']==pytest.approx(0.0)
    with pytest.raises(ValueError):
        decode_sample(raw[:-1])


@pytest.mark.parametrize('identity,model',[(0x68,'MPU-6050'),(0x70,'MPU-6500')])
def test_imu_retries_bus_failure_and_reports_fresh_sample(identity,model):
    class Stop:
        done=False
        def is_set(self):return self.done
        def wait(self,_):pass

    stop=Stop()
    opens=[]
    raw=struct.pack('>hhhhhhh',0,0,16384,0,0,0,131)

    class Bus:
        def __init__(self,attempt):self.attempt=attempt
        def read_byte_data(self,address,register):
            assert (address,register)==(0x68,0x75)
            if self.attempt==1:raise OSError('temporary I2C fault')
            return identity
        def write_byte_data(self,address,register,value):
            assert address==0x68
        def read_i2c_block_data(self,address,register,length):
            assert (address,register,length)==(0x68,0x3B,14)
            stop.done=True
            return list(raw)
        def close(self):pass

    def factory():
        opens.append(1)
        return Bus(len(opens))

    imu=Imu(bus_factory=factory)
    imu.run(stop)
    status=imu.status()
    assert len(opens)==2
    assert status['available']
    assert status['model']==model
    assert status['sample']['gyro_z_dps']==pytest.approx(1.0)
    assert status['error']==''
