"""Bounded latest-frame capture. Production never substitutes a synthetic image."""
import threading
import time


class Camera:
    def __init__(self, controller, mock=False):
        self.controller=controller
        self.mock=mock
        self.frame=None
        self.frame_time=None
        self.error='starting'
        self.lock=threading.Lock()

    def latest(self):
        with self.lock:
            if self.frame_time is None or time.monotonic()-self.frame_time > 0.5:
                return None
            return self.frame

    def run(self,stop_event):
        import cv2
        while not stop_event.is_set():
            camera=None
            try:
                if not self.mock:
                    from picamera2 import Picamera2
                    camera=Picamera2()
                    camera.configure(camera.create_video_configuration(
                        main={'size':(640,480),'format':'RGB888'},controls={'FrameRate':20}))
                    camera.start()
                while not stop_event.is_set():
                    if self.mock:
                        import numpy as np
                        image=np.zeros((480,640,3),dtype=np.uint8)
                        cv2.putText(image,'MOCK CAMERA - NO HARDWARE',(30,240),
                                    cv2.FONT_HERSHEY_SIMPLEX,0.75,(60,200,255),2)
                        acquired=time.monotonic()
                        stop_event.wait(0.05)
                    else:
                        request=camera.capture_request()
                        try:
                            image=request.make_array('main')
                            sensor=request.get_metadata()['SensorTimestamp']
                            age=(time.clock_gettime_ns(time.CLOCK_BOOTTIME)-sensor)*1e-9
                            if not 0 <= age <= 0.5:
                                raise RuntimeError('Stale camera frame')
                            acquired=time.monotonic()-age
                        finally:
                            request.release()
                    valid,jpeg=cv2.imencode('.jpg',image,[cv2.IMWRITE_JPEG_QUALITY,75])
                    if not valid:
                        raise RuntimeError('JPEG encoding failed')
                    with self.lock:
                        self.frame=jpeg.tobytes()
                        self.frame_time=acquired
                        self.error=''
                    self.controller.camera_frame(acquired)
            except Exception as error:
                with self.lock:
                    self.error=str(error)
                    self.frame=None
                    self.frame_time=None
                self.controller.engage()
            finally:
                if camera:
                    for cleanup in (camera.stop,camera.close):
                        try:
                            cleanup()
                        except Exception as error:
                            with self.lock:
                                self.error=str(error)
                                self.frame=None
                                self.frame_time=None
                            self.controller.engage()
            if not stop_event.is_set():
                stop_event.wait(1.0)
