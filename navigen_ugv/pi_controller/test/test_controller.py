import math
import pytest
from pi_controller.controller import Controller


def tick(c,now,camera=True):
    if camera:
        c.camera_frame(now)
    c.step(now)


def ready():
    c=Controller(mock=True)
    tick(c,1)
    tick(c,1.02)
    c.release(1.02)
    tick(c,1.04)
    tick(c,1.06)
    assert c.armed and not c.estop
    return c


def drive(c,linear=0.12,angular=0,start=1.08,cycles=8):
    for i in range(cycles):
        now=start+i*.02
        c.command_velocity(linear,angular,now)
        tick(c,now)


def test_startup_release_new_command_and_deadman():
    c=Controller(mock=True)
    tick(c,1)
    assert c.estop and not c.armed
    with pytest.raises(ValueError):
        c.command_velocity(0.1,0,1)
    c=ready()
    assert c.mock.target == (0,0)
    drive(c)
    assert c.mock.target[0] > 0
    tick(c,1.7)
    assert c.mock.target == (0,0)
    assert 'command_stale' in c.reasons


def test_rear_guard_reverse_pivot_and_forward_camera_view():
    c=ready()
    c.mock.ultrasonic_left=.2
    drive(c,linear=-.1)
    assert c.mock.target == (0,0)
    assert 'rear_obstacle_or_sensor_invalid' in c.reasons
    drive(c,linear=0,angular=.3,start=1.3)
    assert c.mock.target == (0,0)
    drive(c,linear=.1,start=1.5)
    assert min(c.mock.target)>0  # Rear sensor is not a fictitious front sensor.


def test_invalid_rear_reading_blocks_reverse():
    c=ready()
    c.mock.ultrasonic_left=-1
    drive(c,linear=-.1)
    assert c.mock.target == (0,0)


def test_camera_loss_stops_and_rejects_release():
    c=ready()
    drive(c)
    c.command_velocity(.1,0,2)
    tick(c,2,camera=False)
    assert c.mock.target == (0,0)
    assert 'camera_stale' in c.reasons
    c.engage()
    with pytest.raises(ValueError,match='camera'):
        c.release(2)


@pytest.mark.parametrize('value',[math.nan,math.inf,-math.inf,True,'0.1',None])
def test_malformed_command_latches_stop(value):
    c=ready()
    with pytest.raises(ValueError):
        c.command_velocity(value,0,1.1)
    assert c.estop and not c.armed


def test_hardware_stop_and_disconnection_require_new_release():
    c=ready()
    drive(c)
    c.mock.hardware_estop=True
    tick(c,1.3)
    assert c.estop and c.mock.target == (0,0)
    c.mock.hardware_estop=False
    tick(c,1.4)
    assert c.estop
    c=ready()
    c.mock.exchange=lambda *_:b''
    tick(c,2)
    assert c.estop and 'controller_unavailable' in c.reasons


def test_replayed_telemetry_cannot_keep_connection_alive():
    c=ready()
    data=c.mock.exchange(b'',.02,1.08)
    c.mock.exchange=lambda *_:data
    tick(c,1.08)
    tick(c,1.2)
    tick(c,1.4)
    assert c.estop


def test_explicit_estop_shutdown_and_no_fake_feedback():
    c=ready()
    drive(c)
    assert c.telemetry.left_velocity == 0 and c.telemetry.left_ticks == 0
    c.engage()
    tick(c,1.3)
    assert c.mock.target == (0,0) and c.mock.software_estop
    c.close()
    c.close()
    assert c.closed


def test_rear_guard_stops_deceleration_before_direction_changes():
    c=ready()
    drive(c,linear=-.1)
    assert c.mock.target[0]<0
    c.mock.ultrasonic_left=.2
    c.command_velocity(.1,0,1.3)
    tick(c,1.3)
    assert c.mock.target == (0,0)


def test_operator_zero_command_stops_without_deceleration_ramp():
    c=ready()
    drive(c)
    assert c.mock.target[0]>0
    c.command_velocity(0,0,1.3)
    tick(c,1.3)
    assert c.mock.target == (0,0)


def test_dashboard_buzzer_settings_are_sent_and_reported_by_firmware():
    c=Controller(mock=True)
    c.configure_buzzer(True,30)
    tick(c,1.0)
    tick(c,1.02)
    assert c.mock.buzzer_enabled
    assert c.mock.buzzer_threshold_mm == 300
    assert c.telemetry.buzzer_enabled
    assert c.telemetry.buzzer_threshold_mm == 300
    status=c.status()
    assert status['buzzer']['enabled']
    assert status['buzzer']['threshold_cm'] == 30
    assert status['firmware_buzzer']['enabled']
    c.close()


@pytest.mark.parametrize('enabled,threshold',[('yes',30),(True,4),(False,401)])
def test_invalid_dashboard_buzzer_settings_are_rejected(enabled,threshold):
    c=Controller(mock=True)
    with pytest.raises(ValueError):
        c.configure_buzzer(enabled,threshold)
