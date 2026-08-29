# Telemetry stream from the ESP32 motor controller (20-50 Hz).
std_msgs/Header header

float32 left_velocity      # measured left side velocity [m/s]
float32 right_velocity     # measured right side velocity [m/s]
float32 left_setpoint      # commanded left side velocity [m/s]
float32 right_setpoint     # commanded right side velocity [m/s]
int16 left_pwm             # applied PWM (-max_pwm..max_pwm)
int16 right_pwm
int64 left_ticks           # cumulative encoder ticks
int64 right_ticks
float32 battery_voltage    # [V]
float32 ultrasonic_left    # [m], -1.0 = invalid reading
float32 ultrasonic_right   # [m], -1.0 = invalid reading
bool estop_active          # hardware e-stop input state
bool watchdog_triggered    # true if the 300 ms command watchdog fired
