"""Thread-safe motor session with command/camera/serial watchdogs and rear guard."""
from dataclasses import asdict
from pi_controller.imu import decode_sample
import math
import threading
import time
from navigen_hardware import serial_protocol as wire
from navigen_hardware.kinematics import DiffDriveKinematics,KinematicsConfig,MotionCommandLimiter
from navigen_hardware.mock_motor_controller import MockMotorController
from navigen_hardware.serial_transport import ReconnectingSerial


class Controller:
    def __init__(self, port='/dev/ttyUSB0', mock=False, track_width=0.34):
        self.lock=threading.RLock()
        self.kinematics=DiffDriveKinematics(KinematicsConfig(0.0625,track_width,0.15,0.5,0.2))
        self.limiter=MotionCommandLimiter(self.kinematics,0.3,0.8)
        self.transport=None if mock else ReconnectingSerial(port,115200,1.0)
        self.mock=MockMotorController(0.2,255,0.3,battery_voltage=0.0) if mock else None
        self.parser=wire.FrameParser()
        self.sequence=0
        self.telemetry=None
        self.telemetry_time=None
        self.telemetry_sequence=None
        self.imu_sample=None
        self.imu_time=None
        self.imu_model=None
        self.camera_time=None
        self.command_time=None
        self.command=(0.0,0.0)
        self.estop=True
        self.armed=False
        self.release_time=None
        self.last_step=None
        self.last_estop_sent=-math.inf
        self.buzzer_enabled=False
        self.buzzer_threshold_mm=300
        self.last_buzzer_config_sent=-math.inf
        self.reasons=['startup_estop']
        self.closed=False

    def next_sequence(self):
        self.sequence=(self.sequence+1)&0xffff
        return self.sequence

    def camera_frame(self,now=None):
        with self.lock:
            self.camera_time=time.monotonic() if now is None else now

    def command_velocity(self,linear,angular,now=None):
        if (isinstance(linear,bool) or isinstance(angular,bool) or
                not isinstance(linear,(int,float)) or not isinstance(angular,(int,float)) or
                not math.isfinite(linear) or not math.isfinite(angular)):
            self.engage()
            raise ValueError('Finite numeric linear/angular commands required')
        with self.lock:
            if self.estop or not self.armed:
                raise ValueError('Release e-stop and wait for controller ready')
            self.command=(linear,angular)
            self.command_time=time.monotonic() if now is None else now

    def engage(self):
        with self.lock:
            self.estop=True
            self.armed=False
            self.release_time=None
            self.command=(0.0,0.0)
            self.command_time=None
            self.limiter.reset()

    def release(self,now=None):
        with self.lock:
            now=time.monotonic() if now is None else now
            if not self.contract_ready(now) or self.camera_time is None or not 0 <= now-self.camera_time <= 0.5:
                raise ValueError('Release requires a live camera and fresh, configured ESP8266 telemetry')
            self.estop=False
            self.armed=False
            self.release_time=now
            self.command=(0.0,0.0)
            self.command_time=None
            self.last_estop_sent=-math.inf

    def configure_buzzer(self,enabled,threshold_cm):
        if not isinstance(enabled,bool):
            raise ValueError('enabled must be true or false')
        if (isinstance(threshold_cm,bool) or
                not isinstance(threshold_cm,(int,float)) or
                not math.isfinite(threshold_cm) or
                not 5.0 <= threshold_cm <= 400.0):
            raise ValueError('threshold_cm must be between 5 and 400')
        threshold_mm=int(round(threshold_cm*10.0))
        with self.lock:
            self.buzzer_enabled=enabled
            self.buzzer_threshold_mm=threshold_mm
            self.last_buzzer_config_sent=-math.inf

    def contract_ready(self,now):
        return (self.telemetry is not None and self.telemetry_time is not None and
                0 <= now-self.telemetry_time <= 0.25 and
                self.telemetry.configuration_valid and self.telemetry.open_loop_mode)

    def send(self,frame,now):
        if self.mock:
            self.mock.receive(frame,now)
            return True
        return self.transport.write(frame,now)

    def step(self,now=None):
        with self.lock:
            if self.closed:
                return
            now=time.monotonic() if now is None else now
            dt=0.02 if self.last_step is None else max(0.001,min(0.1,now-self.last_step))
            self.last_step=now
            data=self.mock.exchange(b'',dt,now) if self.mock else self.transport.read(now)
            for frame in self.parser.feed(data):
                if frame.message_id == wire.MSG_IMU:
                    if len(frame.payload) != 15 or frame.payload[0] not in (0x68,0x70):
                        continue
                    try:
                        self.imu_sample=decode_sample(frame.payload[1:])
                    except ValueError:
                        continue
                    self.imu_model='MPU-6050' if frame.payload[0] == 0x68 else 'MPU-6500'
                    self.imu_time=now
                    continue
                if frame.message_id != wire.MSG_TELEMETRY:
                    continue
                if self.telemetry_sequence is not None and not 0 < ((frame.sequence-self.telemetry_sequence)&0xffff) < 0x8000:
                    continue
                try:
                    self.telemetry=wire.decode_telemetry(frame.payload)
                except ValueError:
                    continue
                self.telemetry_sequence=frame.sequence
                self.telemetry_time=now
            if now-self.last_buzzer_config_sent >= 0.5:
                config=wire.encode_buzzer_config(
                    self.buzzer_enabled,self.buzzer_threshold_mm,
                    self.next_sequence(),
                )
                sent=self.send(config,now)
                self.last_buzzer_config_sent=now
                if not sent:
                    self.engage()
            if not self.contract_ready(now):
                self.engage()
                # Permit a freshly booted controller's sequence after the link has expired.
                self.telemetry_sequence=None
            if self.camera_time is None or not 0 <= now-self.camera_time <= 0.5:
                # A lost camera requires an explicit operator release after recovery.
                # Do not resume a held drive command when frames start arriving again.
                self.engage()
            if self.release_time is not None:
                if self.telemetry and not self.telemetry.estop_active:
                    self.release_time=None
                    self.armed=True
                elif now-self.release_time > 0.5:
                    self.engage()
            elif self.telemetry and self.telemetry.estop_active and not self.estop:
                self.engage()
            reasons=[]
            if self.estop or not self.armed:
                reasons.append('estop')
            if not self.contract_ready(now):
                reasons.append('controller_unavailable')
            if self.camera_time is None or not 0 <= now-self.camera_time <= 0.5:
                reasons.append('camera_stale')
            if self.command_time is None or not 0 <= now-self.command_time <= 0.25:
                reasons.append('command_stale')
            left,right=self.kinematics.twist_to_wheels(*self.command)
            # Evaluate both target AND actual limited output, so changing from reverse
            # to forward cannot coast backwards through a newly detected rear obstacle.
            current_left,current_right=self.kinematics.twist_to_wheels(self.limiter.linear,self.limiter.angular)
            if min(left,right,current_left,current_right) < 0:
                rear=self.telemetry.ultrasonic_left if self.telemetry else -1
                if not math.isfinite(rear) or not 0.35 < rear <= 4.0:
                    reasons.append('rear_obstacle_or_sensor_invalid')
            if reasons or self.command == (0.0,0.0):
                left,right=self.limiter.reset()
            else:
                left,right=self.limiter.step(*self.command,dt)
            self.reasons=reasons
            if not self.send(wire.encode_velocity_command(left,right,self.next_sequence()),now):
                self.engage()
            if now-self.last_estop_sent >= 0.1:
                if not self.send(wire.encode_estop(self.estop,self.next_sequence()),now):
                    self.engage()
                self.last_estop_sent=now

    def status(self):
        with self.lock:
            now=time.monotonic()
            telemetry_age_ms=(None if self.telemetry_time is None else
                              max(0,int((now-self.telemetry_time)*1000)))
            sensor_fresh=(telemetry_age_ms is not None and telemetry_age_ms<=250)
            return dict(mock=self.mock is not None,armed=self.armed,estop=self.estop,
                        reasons=self.reasons,telemetry=asdict(self.telemetry) if self.telemetry else None,
                        telemetry_age_ms=telemetry_age_ms,
                        ultrasonic_valid=bool(sensor_fresh and self.telemetry and
                                              self.telemetry.ultrasonic_left>=0),
                        buzzer=dict(enabled=self.buzzer_enabled,
                                    threshold_mm=self.buzzer_threshold_mm,
                                    threshold_cm=self.buzzer_threshold_mm/10.0),
                        firmware_buzzer=(dict(
                            enabled=self.telemetry.buzzer_enabled,
                            threshold_mm=self.telemetry.buzzer_threshold_mm,
                            threshold_cm=self.telemetry.buzzer_threshold_mm/10.0,
                        ) if self.telemetry else None))

    def imu_status(self):
        with self.lock:
            now=time.monotonic()
            age=None if self.imu_time is None else max(0,int((now-self.imu_time)*1000))
            available=bool(self.imu_sample is not None and age is not None and age <= 500)
            return dict(available=available,address=None,model=self.imu_model,
                        age_ms=age,sample=self.imu_sample.copy() if available else None,
                        error='' if available else 'ESP8266 MPU sample unavailable or stale')

    def close(self):
        with self.lock:
            if self.closed:
                return
            self.engage()
            now=time.monotonic()
            self.send(wire.encode_velocity_command(0,0,self.next_sequence()),now)
            self.send(wire.encode_estop(True,self.next_sequence()),now)
            self.closed=True
            if self.transport:
                self.transport.close()
