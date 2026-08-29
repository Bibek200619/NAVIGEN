// NAVIGEN ESP32 board configuration.
// FILL IN every value marked -1 / 0.0f for YOUR wiring before flashing.
// The firmware refuses to arm propulsion while any required value is unset.
#pragma once

// ---- Motor drivers (per side: two motors wired in parallel per channel or per driver) ----
#define PIN_LEFT_PWM        -1   // SET ME
#define PIN_LEFT_DIR_A      -1   // SET ME
#define PIN_LEFT_DIR_B      -1   // SET ME
#define PIN_RIGHT_PWM       -1   // SET ME
#define PIN_RIGHT_DIR_A     -1   // SET ME
#define PIN_RIGHT_DIR_B     -1   // SET ME
#define MAX_PWM             255  // adjust for your driver/LEDC resolution

// ---- Quadrature encoders (one representative encoder per side minimum) ----
#define PIN_LEFT_ENC_A      -1   // SET ME
#define PIN_LEFT_ENC_B      -1   // SET ME
#define PIN_RIGHT_ENC_A     -1   // SET ME
#define PIN_RIGHT_ENC_B     -1   // SET ME
#define TICKS_PER_REV       0.0f // SET ME: CPR x gear ratio x 4 (quadrature)

// ---- Vehicle geometry (must match navigen_description/config/vehicle.yaml) ----
#define WHEEL_RADIUS_M      0.0f // SET ME
#define TRACK_WIDTH_M       0.0f // SET ME (effective skid-steer track width)

// ---- Ultrasonic sensors (HC-SR04, ECHO through a 5V->3.3V divider) ----
#define PIN_US_LEFT_TRIG    -1   // SET ME
#define PIN_US_LEFT_ECHO    -1   // SET ME
#define PIN_US_RIGHT_TRIG   -1   // SET ME
#define PIN_US_RIGHT_ECHO   -1   // SET ME

// ---- Safety / misc ----
#define PIN_ESTOP_INPUT     -1   // SET ME (hardware e-stop feedback, active level below)
#define ESTOP_ACTIVE_LEVEL  LOW
#define PIN_BATTERY_ADC     -1   // SET ME (through divider)
#define BATTERY_DIVIDER     0.0f // SET ME: Vbat = adc_volts * BATTERY_DIVIDER

// ---- Control loop ----
#define PID_RATE_HZ         100
#define TELEMETRY_RATE_HZ   30
#define WATCHDOG_TIMEOUT_MS 300
#define PID_KP              0.0f // TUNE ME (docs/calibration.md)
#define PID_KI              0.0f // TUNE ME
#define PID_KD              0.0f // TUNE ME

// ---- Serial link to Raspberry Pi ----
#define SERIAL_BAUD         115200
