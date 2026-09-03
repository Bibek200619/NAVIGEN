// NAVIGEN ESP32 board configuration.
// FILL IN every value marked SET ME for the physical vehicle before flashing.
// With the defaults below, firmware builds and reports diagnostics but propulsion stays disabled.
#pragma once

// ---- Four motor outputs (two driver channels per side) ----
#define PIN_MOTOR_LF_PWM       -1  // SET ME
#define PIN_MOTOR_LF_DIR_A     -1  // SET ME
#define PIN_MOTOR_LF_DIR_B     -1  // SET ME
#define MOTOR_LF_INVERTED       0
#define MOTOR_LF_PWM_CHANNEL    0

#define PIN_MOTOR_LR_PWM       -1  // SET ME
#define PIN_MOTOR_LR_DIR_A     -1  // SET ME
#define PIN_MOTOR_LR_DIR_B     -1  // SET ME
#define MOTOR_LR_INVERTED       0
#define MOTOR_LR_PWM_CHANNEL    1

#define PIN_MOTOR_RF_PWM       -1  // SET ME
#define PIN_MOTOR_RF_DIR_A     -1  // SET ME
#define PIN_MOTOR_RF_DIR_B     -1  // SET ME
#define MOTOR_RF_INVERTED       0
#define MOTOR_RF_PWM_CHANNEL    2

#define PIN_MOTOR_RR_PWM       -1  // SET ME
#define PIN_MOTOR_RR_DIR_A     -1  // SET ME
#define PIN_MOTOR_RR_DIR_B     -1  // SET ME
#define MOTOR_RR_INVERTED       0
#define MOTOR_RR_PWM_CHANNEL    3

// Optional shared driver-enable pin. Leave -1 if the drivers have no enable input.
#define PIN_MOTOR_ENABLE       -1
#define MOTOR_ENABLE_LEVEL      1
#define MOTOR_ZERO_BRAKE        0  // 0 = coast (DIR low/low), 1 = brake (DIR high/high)
#define PWM_FREQUENCY_HZ    20000
#define PWM_RESOLUTION_BITS     8
#define MAX_PWM               255  // Must fit PWM_RESOLUTION_BITS.

// ---- Quadrature encoders ----
// At least one complete encoder pair per side is required. A second pair is optional.
#define PIN_ENCODER_LF_A       -1  // SET ME or leave both LF pins -1 if LR is fitted
#define PIN_ENCODER_LF_B       -1
#define ENCODER_LF_INVERTED     0
#define PIN_ENCODER_LR_A       -1  // SET ME or leave both LR pins -1 if LF is fitted
#define PIN_ENCODER_LR_B       -1
#define ENCODER_LR_INVERTED     0
#define PIN_ENCODER_RF_A       -1  // SET ME or leave both RF pins -1 if RR is fitted
#define PIN_ENCODER_RF_B       -1
#define ENCODER_RF_INVERTED     0
#define PIN_ENCODER_RR_A       -1  // SET ME or leave both RR pins -1 if RF is fitted
#define PIN_ENCODER_RR_B       -1
#define ENCODER_RR_INVERTED     0
#define ENCODER_USE_PULLUPS     1
#define TICKS_PER_REV        0.0f  // SET ME: decoded ticks per output-shaft revolution

// ---- Vehicle geometry and controller limits ----
#define WHEEL_RADIUS_M       0.0f  // SET ME; match ROS hardware.yaml
#define TRACK_WIDTH_M        0.0f  // SET ME; effective skid-steer track width
#define MAX_WHEEL_VELOCITY_MPS 0.0f  // SET ME conservatively

// ---- Independent side velocity PID gains ----
#define LEFT_PID_KP          0.0f  // SET/TUNE ME
#define LEFT_PID_KI          0.0f
#define LEFT_PID_KD          0.0f
#define RIGHT_PID_KP         0.0f  // SET/TUNE ME
#define RIGHT_PID_KI         0.0f
#define RIGHT_PID_KD         0.0f

// ---- HC-SR04 backup sensors; ECHO must use a 5 V -> 3.3 V divider ----
#define PIN_US_LEFT_TRIG       -1  // SET ME
#define PIN_US_LEFT_ECHO       -1  // SET ME
#define PIN_US_RIGHT_TRIG      -1  // SET ME
#define PIN_US_RIGHT_ECHO      -1  // SET ME
#define ULTRASONIC_SAMPLE_PERIOD_MS 50
#define ULTRASONIC_ECHO_TIMEOUT_US 24000
#define ULTRASONIC_STALE_MS    250

// ---- Safety and battery status ----
// The physical e-stop must also interrupt motor power in hardware; this pin is feedback.
#define PIN_ESTOP_INPUT        -1  // SET ME
#define ESTOP_ACTIVE_LEVEL      0
#define ESTOP_USE_PULLUP        1
#define PIN_BATTERY_ADC        -1  // SET ME; use a suitable ADC-capable pin
#define BATTERY_DIVIDER       0.0f // SET ME: Vbattery / Vadc

// ---- Scheduling and serial ----
#define MOTOR_PID_RATE_HZ      100
#define TELEMETRY_RATE_HZ       30
#define WATCHDOG_TIMEOUT_MS     300
#define SERIAL_BAUD          115200
