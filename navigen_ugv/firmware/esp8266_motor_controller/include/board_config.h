// NAVIGEN NodeMCU ESP8266 open-loop hardware profile.
// GPIO assignments are centralized here and may be changed for another wiring layout.
// Propulsion stays disabled until the wiring has been reviewed and the confirmation flag is set.
// The 3S battery feeds the L298N motor rail directly: 12.6 V was measured
// previously, and about 12 V was confirmed on 2026-10-03. The owner confirmed
// 3.6 V is the motor's maximum voltage. Two motors are wired in parallel on each
// L298N channel. A multimeter reading near 3 V at a motor does not establish
// the voltage of each PWM on-pulse or the stall current. Keep propulsion locked.
#pragma once

// Set to 1 only after the pin map, motor directions, voltage dividers, physical
// stop circuit, and lifted-wheel test setup have been peer-reviewed.
#ifndef HARDWARE_CONFIGURATION_CONFIRMED
#define HARDWARE_CONFIGURATION_CONFIRMED 0
#endif
#ifndef LIFTED_WHEEL_BENCH_ONLY
#define LIFTED_WHEEL_BENCH_ONLY 0
#endif
#define BENCH_DRIVE_WINDOW_MS 30000UL

// ---- One L298N, both motors on each side wired in parallel ----
// Keep the L298N ENA and ENB jumpers INSTALLED. PWM is applied to one direction
// input at a time, reducing the NodeMCU motor interface from six GPIOs to four.
// NodeMCU label -> ESP8266 GPIO: D1=5, D2=4, D5=14, D6=12.
#define PIN_MOTOR_LEFT_A         5  // D1 -> IN1
#define PIN_MOTOR_LEFT_B         4  // D2 -> IN2
#define PIN_MOTOR_RIGHT_A       14  // D5 -> IN3
#define PIN_MOTOR_RIGHT_B       12  // D6 -> IN4
#define PIN_MOTOR_LEFT_ENABLE   -1  // ENA jumper installed; no GPIO used
#define PIN_MOTOR_RIGHT_ENABLE  -1  // ENB jumper installed; no GPIO used
#define MOTOR_LEFT_INVERTED      0
#define MOTOR_RIGHT_INVERTED     0

// Static commissioning record, NOT live battery monitoring. Keep the highest
// measured motor-supply voltage, not the PWM-averaged voltage at a motor.
// The 3.6 V limit is the owner-confirmed motor maximum. Reassess
// driver compatibility and current capacity before changing this profile.
#define MOTOR_SUPPLY_MEASURED_MV 12600
#define MOTOR_RATED_MAX_MV        3600
#if HARDWARE_CONFIGURATION_CONFIRMED && !LIFTED_WHEEL_BENCH_ONLY && \
    (MOTOR_SUPPLY_MEASURED_MV <= 0 || \
     MOTOR_SUPPLY_MEASURED_MV > MOTOR_RATED_MAX_MV)
#error "Motor supply is outside the recorded motor voltage rating"
#endif

// ESP8266 Arduino software PWM. The full scale stays 255; limiting the motor
// output to 127/255 yields a 49.8% maximum duty cycle. Setting the PWM range
// itself to 127 would still allow 100% duty and must not be used as a cap.
// This is a supplemental effort limit, not a voltage or current regulator.
#define PWM_FREQUENCY_HZ      1000
#define PWM_RANGE              255
#ifndef PWM_DUTY_LIMIT
#define PWM_DUTY_LIMIT         127
#endif
#if PWM_DUTY_LIMIT * 2 > PWM_RANGE
#error "Motor PWM duty limit exceeds 50 percent"
#endif
#if LIFTED_WHEEL_BENCH_ONLY && \
    (PWM_DUTY_LIMIT > 80 || !HARDWARE_CONFIGURATION_CONFIRMED || BENCH_DRIVE_WINDOW_MS > 30000UL)
#error "Lifted-wheel bench profile requires confirmation, <=80 PWM, and <=30 seconds"
#endif
#define MIN_EFFECTIVE_PWM        0  // Tune on stands; zero disables minimum boost.
#define OPEN_LOOP_DEADBAND_MPS 0.01f
#ifndef MAX_WHEEL_VELOCITY_MPS
#define MAX_WHEEL_VELOCITY_MPS 0.20f
#endif
// Encoderless trim may only reduce a faster side; never use it to exceed limits.
#define LEFT_PWM_SCALE          1.0f
#define RIGHT_PWM_SCALE         1.0f

// ---- One centered HC-SR04 backup sensor ----
// NodeMCU label -> ESP8266 GPIO: D8=15, D7=13. GPIO15 must remain LOW at boot;
// connect it only to the high-impedance HC-SR04 TRIG. ECHO is 5 V and MUST pass
// through a verified divider before D7. D7 is free because the L298N ENB jumper
// stays installed (as does ENA).
#define ULTRASONIC_ENABLED        1
#define PIN_US_FRONT_TRIG        15  // D8 -> TRIG
#define PIN_US_FRONT_ECHO        13  // D7 <- ECHO through verified divider
#define ULTRASONIC_SAMPLE_PERIOD_MS 80
#define ULTRASONIC_ECHO_TIMEOUT_US 24000
#define ULTRASONIC_STALE_MS    250
#define ULTRASONIC_REVERSE_STOP_MM 300

// ---- Optional MPU-6050/6500 on ESP8266 I2C ----
// The installed MPU is connected to the Raspberry Pi I2C bus, so leave this
// off. D3/GPIO0 and D4/GPIO2 must both stay HIGH at boot if a future build
// moves the module to the ESP8266. Use 3.3 V I2C pullups, never 5 V.
#define IMU_ENABLED               0
#define PIN_IMU_SDA               0   // D3
#define PIN_IMU_SCL               2   // D4
#define IMU_I2C_ADDRESS        0x68   // AD0 low; use 0x69 if AD0 high
#define IMU_SAMPLE_PERIOD_MS     50

// ---- Proximity buzzer ----
// NodeMCU D0/GPIO16 is wired directly to an active buzzer in the current build.
// Keep the dashboard buzzer off until its GPIO load is verified, or fit a
// suitable transistor driver for a buzzer whose current exceeds GPIO limits.
#define BUZZER_ENABLED             1
#define BUZZER_DEFAULT_ENABLED     0
#define PIN_BUZZER                16  // D0 -> active buzzer or driver input
#define BUZZER_ACTIVE_LEVEL        1
#define BUZZER_NEAR_DISTANCE_MM  300  // Default threshold; configurable from Pi dashboard
#define BUZZER_BEEP_ON_MS        120
#define BUZZER_BEEP_PERIOD_MS    500

// ---- Safety and battery status ----
// Disabled while D0 is assigned to the buzzer. A future motor-power feedback
// input needs a separate GPIO or a redesigned circuit; never drive one GPIO
// with both the buzzer output and battery feedback. Software e-stop, watchdog,
// and configuration lockout remain active.
#define ESTOP_INPUT_ENABLED      0

// D0 is GPIO16 and supports INPUT_PULLDOWN_16. Normal operation must present a
// safe 3.3 V HIGH; opening the motor-power switch must make this input LOW. A
// single suitably rated switch can cut L298N motor supply while D0 senses the
// switched side through a correctly calculated divider. Never feed battery
// voltage directly into D0.
#define PIN_ESTOP_INPUT         16  // D0
#define ESTOP_ACTIVE_LEVEL       0
#define ESTOP_USE_PULLDOWN_16    1

// NodeMCU A0 scaling varies between boards, so battery telemetry is disabled
// until its safe full-scale input is measured. Never assume A0 accepts 3.3 V.
#define BATTERY_MONITOR_ENABLED  0
#define PIN_BATTERY_ADC         A0
#define ADC_FULL_SCALE_MV        0  // SET ME if battery monitoring is enabled
#define BATTERY_DIVIDER       0.0f  // SET ME: Vbattery / Vadc

// ---- Scheduling and serial ----
#define MOTOR_CONTROL_RATE_HZ  100
#define TELEMETRY_RATE_HZ       30
#define WATCHDOG_TIMEOUT_MS     300
#define SERIAL_BAUD          115200
