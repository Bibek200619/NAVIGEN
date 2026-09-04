# Telemetry stream from the USB-connected motor controller (20-50 Hz).
std_msgs/Header header

float32 left_velocity      # measured [m/s], zero when wheel feedback is unavailable
float32 right_velocity     # measured [m/s], zero when wheel feedback is unavailable
float32 left_setpoint      # commanded left side velocity [m/s]
float32 right_setpoint     # commanded right side velocity [m/s]
int16 left_pwm             # applied PWM (-max_pwm..max_pwm)
int16 right_pwm
int64 left_ticks           # cumulative encoder ticks, zero in open-loop mode
int64 right_ticks          # cumulative encoder ticks, zero in open-loop mode
float32 battery_voltage    # [V]
float32 ultrasonic_left    # [m], -1.0 = invalid reading
float32 ultrasonic_right   # [m], -1.0 = invalid reading
bool estop_active          # hardware e-stop input state
bool watchdog_triggered    # true if the 300 ms command watchdog fired
bool configuration_valid   # false while required firmware settings are unset/invalid
bool open_loop_mode        # true for the encoderless NodeMCU profile
bool wheel_feedback_valid  # false means velocity/tick fields must not be used as odometry
bool serial_connected      # Raspberry Pi bridge currently has a live transport
uint16 acknowledged_command_sequence
float32 command_age        # age of last valid firmware velocity command [s]
uint32 rx_crc_errors       # cumulative CRC rejects reported by the controller
