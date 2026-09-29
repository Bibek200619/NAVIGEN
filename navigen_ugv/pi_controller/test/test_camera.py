import cv2
import numpy as np

from pi_controller.camera import Camera


def test_capture_failure_latches_stop_then_recovers_without_arming(monkeypatch):
    class Controller:
        def __init__(self):
            self.stops=0
            self.frames=0

        def engage(self):
            self.stops+=1

        def camera_frame(self,_):
            self.frames+=1
            stop.set=True

    class Stop:
        set=False

        def is_set(self):
            return self.set

        def wait(self,_):
            pass

    stop=Stop()
    controller=Controller()
    camera=Camera(controller,mock=True)
    attempts=0

    def encode(*_):
        nonlocal attempts
        attempts+=1
        if attempts==1:
            raise RuntimeError('temporary capture failure')
        return True,np.array([0xff,0xd8,0xff,0xd9],dtype=np.uint8)

    monkeypatch.setattr(cv2,'imencode',encode)
    camera.run(stop)
    assert attempts==2
    assert controller.stops==1
    assert controller.frames==1
    assert camera.error==''
    assert camera.latest()==b'\xff\xd8\xff\xd9'
