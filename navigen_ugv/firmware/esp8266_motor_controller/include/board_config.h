// NAVIGEN NodeMCU ESP8266 open-loop hardware profile.
// GPIO assignments are centralized here and may be changed for another wiring layout.
// Propulsion stays disabled until the wiring has been reviewed and the confirmation flag is set.
#pragma once

// Set to 1 only after the pin map, motor directions, voltage dividers, physical
// stop circuit, and lifted-wheel test setup have been peer-reviewed.
#define HARDWARE_CONFIGURATION_CONFIRMED 0

// ---- One L298N, both motors on each side wired in parallel ----
// Keep the L298N ENA and ENB jumpers INSTALLED. PWM is applied to one direction
// input at a time, reducing the NodeMCU motor interface from six GPIOs to four.
// NodeMCU label -> ESP8266 GPIO: D1=5, D2=4, D5=14, D6=12.
#define PIN_MOTOR_LEFT_A         5  // D1 -> IN1
#define PIN_MOTOR_LEFT_B         4  // D2 -> IN2
#define PIN_MOTOR_RIGHT_A       14  // D5 -> IN3
#define PIN_MOTOR_RIGHT_B       12  // D6 -> IN4
#define MOTOR_LEFT_INVERTED      0
#define MOTOR_RIGHT_INVERTED     0

// ESP8266 Arduino software PWM. The range is set explicitly so core-version
// defaults cannot silently change motor output.
#define PWM_FREQUENCY_HZ      1000
#define MAX_PWM                255
#define MIN_EFFECTIVE_PWM        0  // Tune on stands; zero disables minimum boost.
#define OPEN_LOOP_DEADBAND_MPS 0.01f
#define MAX_WHEEL_VELOCITY_MPS 0.20f
// Encoderless trim may only reduce a faster side; never use it to exceed limits.
#define LEFT_PWM_SCALE          1.0f
#define RIGHT_PWM_SCALE         1.0f

// ---- One centered HC-SR04 backup sensor ----
// NodeMCU label -> ESP8266 GPIO: D8=15, D7=13. GPIO15 is a boot strap pin and
// must remain LOW at boot; connect it only to the high-impedance HC-SR04 TRIG.
// ECHO is 5 V and MUST pass through a verified divider before D7.
#define PIN_US_FRONT_TRIG        15  // D8 -> TRIG
#define PIN_US_FRONT_ECHO        13  // D7 <- divided ECHO
#define ULTRASONIC_SAMPLE_PERIOD_MS 80
#define ULTRASONIC_ECHO_TIMEOUT_US 24000
#define ULTRASONIC_STALE_MS    250

// ---- Safety and battery status ----
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
