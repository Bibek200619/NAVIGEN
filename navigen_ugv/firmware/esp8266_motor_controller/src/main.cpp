#include <Arduino.h>

#include <array>
#include <cmath>
#include <cstdint>

#include "board_config.h"
#include "navigen_control.hpp"
#include "navigen_protocol.hpp"

namespace {

using navigen::control::CommandWatchdog;
using navigen::protocol::Frame;
using navigen::protocol::FrameParser;

constexpr uint32_t CONTROL_PERIOD_US =
    1000000UL / MOTOR_CONTROL_RATE_HZ;
constexpr uint32_t TELEMETRY_PERIOD_US = 1000000UL / TELEMETRY_RATE_HZ;

struct MotorChannel {
  int pin_a;
  int pin_b;
  bool inverted;
};

struct UltrasonicSensor {
  int trigger_pin;
  int echo_pin;
  volatile uint32_t rise_us{0};
  volatile uint32_t pulse_us{0};
  volatile uint32_t update_us{0};
};

MotorChannel motor_left{PIN_MOTOR_LEFT_A, PIN_MOTOR_LEFT_B,
                        MOTOR_LEFT_INVERTED != 0};
MotorChannel motor_right{PIN_MOTOR_RIGHT_A, PIN_MOTOR_RIGHT_B,
                         MOTOR_RIGHT_INVERTED != 0};
UltrasonicSensor ultrasonic_front{PIN_US_FRONT_TRIG, PIN_US_FRONT_ECHO};

FrameParser parser;
CommandWatchdog watchdog(WATCHDOG_TIMEOUT_MS);

bool configuration_valid = false;
bool hardware_ready = false;
bool software_estop = false;
bool host_sequence_seen = false;
uint16_t last_host_sequence = 0;
uint16_t acknowledged_sequence = 0;
uint16_t telemetry_sequence = 0;
float left_target_mps = 0.0F;
float right_target_mps = 0.0F;
int16_t left_pwm = 0;
int16_t right_pwm = 0;
uint32_t last_control_us = 0;
uint32_t last_telemetry_us = 0;
uint32_t last_ultrasonic_ms = 0;

bool supportedDigitalPin(int pin) {
  switch (pin) {
    case 0:
    case 2:
    case 4:
    case 5:
    case 12:
    case 13:
    case 14:
    case 15:
    case 16:
      return true;
    default:
      return false;
  }
}

bool motorPinSafe(int pin) {
  // Never drive serial, flash, or boot-strap GPIOs with motor PWM.
  return pin == 4 || pin == 5 || pin == 12 || pin == 13 || pin == 14 ||
         pin == 16;
}

bool pinsAreUnique() {
  const std::array<int, 7> pins{
      PIN_MOTOR_LEFT_A,  PIN_MOTOR_LEFT_B,    PIN_MOTOR_RIGHT_A,
      PIN_MOTOR_RIGHT_B, PIN_US_FRONT_TRIG,   PIN_US_FRONT_ECHO,
      PIN_ESTOP_INPUT,
  };
  for (std::size_t first = 0; first < pins.size(); ++first) {
    for (std::size_t second = first + 1; second < pins.size(); ++second) {
      if (pins[first] == pins[second]) {
        return false;
      }
    }
  }
  return true;
}

bool validateConfiguration() {
  const bool pins_supported =
      supportedDigitalPin(PIN_MOTOR_LEFT_A) &&
      supportedDigitalPin(PIN_MOTOR_LEFT_B) &&
      supportedDigitalPin(PIN_MOTOR_RIGHT_A) &&
      supportedDigitalPin(PIN_MOTOR_RIGHT_B) &&
      supportedDigitalPin(PIN_US_FRONT_TRIG) &&
      supportedDigitalPin(PIN_US_FRONT_ECHO) &&
      supportedDigitalPin(PIN_ESTOP_INPUT);
  const bool motor_pins_safe =
      motorPinSafe(PIN_MOTOR_LEFT_A) && motorPinSafe(PIN_MOTOR_LEFT_B) &&
      motorPinSafe(PIN_MOTOR_RIGHT_A) && motorPinSafe(PIN_MOTOR_RIGHT_B);
  const bool control_configured =
      MAX_WHEEL_VELOCITY_MPS > 0.0F && OPEN_LOOP_DEADBAND_MPS >= 0.0F &&
      OPEN_LOOP_DEADBAND_MPS < MAX_WHEEL_VELOCITY_MPS && MAX_PWM > 0 &&
      MAX_PWM <= 1023 && MIN_EFFECTIVE_PWM >= 0 &&
      MIN_EFFECTIVE_PWM <= MAX_PWM && PWM_FREQUENCY_HZ >= 100 &&
      PWM_FREQUENCY_HZ <= 40000 && MOTOR_CONTROL_RATE_HZ >= 50 &&
      TELEMETRY_RATE_HZ >= 20 && WATCHDOG_TIMEOUT_MS > 0 &&
      LEFT_PWM_SCALE > 0.0F && LEFT_PWM_SCALE <= 1.0F &&
      RIGHT_PWM_SCALE > 0.0F && RIGHT_PWM_SCALE <= 1.0F;
  const bool ultrasonic_configured =
      PIN_US_FRONT_TRIG != PIN_US_FRONT_ECHO &&
      ULTRASONIC_SAMPLE_PERIOD_MS > 0 && ULTRASONIC_ECHO_TIMEOUT_US > 0 &&
      ULTRASONIC_STALE_MS > 0;
  const bool battery_configured =
      BATTERY_MONITOR_ENABLED == 0 ||
      (ADC_FULL_SCALE_MV > 0 && BATTERY_DIVIDER > 0.0F);
  return HARDWARE_CONFIGURATION_CONFIRMED == 1 && pins_supported &&
         motor_pins_safe && pinsAreUnique() && control_configured &&
         ultrasonic_configured && battery_configured;
}

void IRAM_ATTR ultrasonicEchoInterrupt() {
  const uint32_t now_us = micros();
  if (digitalRead(ultrasonic_front.echo_pin) != 0) {
    ultrasonic_front.rise_us = now_us;
  } else {
    ultrasonic_front.pulse_us =
        static_cast<uint32_t>(now_us - ultrasonic_front.rise_us);
    ultrasonic_front.update_us = now_us;
  }
}

void configureMotor(const MotorChannel& motor) {
  pinMode(motor.pin_a, OUTPUT);
  pinMode(motor.pin_b, OUTPUT);
  digitalWrite(motor.pin_a, LOW);
  digitalWrite(motor.pin_b, LOW);
}

void configureHardware() {
  analogWriteRange(MAX_PWM);
  analogWriteFreq(PWM_FREQUENCY_HZ);
  configureMotor(motor_left);
  configureMotor(motor_right);
  pinMode(PIN_US_FRONT_TRIG, OUTPUT);
  digitalWrite(PIN_US_FRONT_TRIG, LOW);
  pinMode(PIN_US_FRONT_ECHO, INPUT);
  attachInterrupt(digitalPinToInterrupt(PIN_US_FRONT_ECHO),
                  ultrasonicEchoInterrupt, CHANGE);
  pinMode(PIN_ESTOP_INPUT,
          ESTOP_USE_PULLDOWN_16 != 0 ? INPUT_PULLDOWN_16 : INPUT);
#if BATTERY_MONITOR_ENABLED
  pinMode(PIN_BATTERY_ADC, INPUT);
#endif
  hardware_ready = true;
}

void writeMotor(const MotorChannel& motor, int16_t requested_pwm) {
  if (!hardware_ready) {
    return;
  }
  int value = navigen::control::clamp<int>(requested_pwm, -MAX_PWM, MAX_PWM);
  if (motor.inverted) {
    value = -value;
  }
  analogWrite(motor.pin_a, 0);
  analogWrite(motor.pin_b, 0);
  if (value > 0) {
    analogWrite(motor.pin_a, value);
  } else if (value < 0) {
    analogWrite(motor.pin_b, -value);
  }
}

void disablePropulsion() {
  if (hardware_ready) {
    writeMotor(motor_left, 0);
    writeMotor(motor_right, 0);
  }
  left_pwm = 0;
  right_pwm = 0;
}

bool physicalEstopActive() {
  return configuration_valid &&
         digitalRead(PIN_ESTOP_INPUT) == ESTOP_ACTIVE_LEVEL;
}

bool stopRequired(uint32_t now_ms) {
  return !configuration_valid || software_estop || physicalEstopActive() ||
         watchdog.expired(now_ms);
}

void runControl(uint32_t now_ms) {
  if (stopRequired(now_ms)) {
    disablePropulsion();
    return;
  }
  left_pwm = navigen::control::openLoopVelocityToPwm(
      left_target_mps * LEFT_PWM_SCALE, MAX_WHEEL_VELOCITY_MPS,
      MIN_EFFECTIVE_PWM, MAX_PWM, OPEN_LOOP_DEADBAND_MPS);
  right_pwm = navigen::control::openLoopVelocityToPwm(
      right_target_mps * RIGHT_PWM_SCALE, MAX_WHEEL_VELOCITY_MPS,
      MIN_EFFECTIVE_PWM, MAX_PWM, OPEN_LOOP_DEADBAND_MPS);
  writeMotor(motor_left, left_pwm);
  writeMotor(motor_right, right_pwm);
}

bool acceptHostSequence(uint16_t sequence, uint32_t now_ms) {
  if (host_sequence_seen &&
      !navigen::protocol::isNewerSequence(sequence, last_host_sequence) &&
      !watchdog.expired(now_ms)) {
    return false;
  }
  host_sequence_seen = true;
  last_host_sequence = sequence;
  acknowledged_sequence = sequence;
  return true;
}

void processFrame(const Frame& frame, uint32_t now_ms) {
  float left = 0.0F;
  float right = 0.0F;
  bool estop = false;
  if (navigen::protocol::decodeVelocity(frame, left, right)) {
    if (!acceptHostSequence(frame.sequence, now_ms)) {
      return;
    }
    left_target_mps = navigen::control::clamp(
        left, -MAX_WHEEL_VELOCITY_MPS, MAX_WHEEL_VELOCITY_MPS);
    right_target_mps = navigen::control::clamp(
        right, -MAX_WHEEL_VELOCITY_MPS, MAX_WHEEL_VELOCITY_MPS);
    watchdog.noteCommand(now_ms);
  } else if (navigen::protocol::decodeEstop(frame, estop)) {
    // Safety assertions ignore sequence order. Releases must be ordered unless
    // the watchdog has expired and a new Raspberry Pi session is starting.
    if (!estop && !acceptHostSequence(frame.sequence, now_ms)) {
      return;
    }
    if (estop) {
      host_sequence_seen = true;
      last_host_sequence = frame.sequence;
      acknowledged_sequence = frame.sequence;
    }
    software_estop = estop;
    if (software_estop) {
      disablePropulsion();
    }
  }
}

void processSerial(uint32_t now_ms) {
  Frame frame;
  while (Serial.available() > 0) {
    const int value = Serial.read();
    if (value >= 0 && parser.feed(static_cast<uint8_t>(value), frame)) {
      processFrame(frame, now_ms);
    }
  }
}

void triggerUltrasonic() {
  digitalWrite(ultrasonic_front.trigger_pin, LOW);
  delayMicroseconds(2);
  digitalWrite(ultrasonic_front.trigger_pin, HIGH);
  delayMicroseconds(10);
  digitalWrite(ultrasonic_front.trigger_pin, LOW);
}

void serviceUltrasonic(uint32_t now_ms) {
  if (configuration_valid &&
      static_cast<uint32_t>(now_ms - last_ultrasonic_ms) >=
          ULTRASONIC_SAMPLE_PERIOD_MS) {
    last_ultrasonic_ms = now_ms;
    triggerUltrasonic();
  }
}

uint16_t ultrasonicDistanceMm(uint32_t now_us) {
  noInterrupts();
  const uint32_t pulse_us = ultrasonic_front.pulse_us;
  const uint32_t update_us = ultrasonic_front.update_us;
  interrupts();
  if (update_us == 0 || pulse_us == 0 ||
      pulse_us > ULTRASONIC_ECHO_TIMEOUT_US ||
      static_cast<uint32_t>(now_us - update_us) >
          ULTRASONIC_STALE_MS * 1000UL) {
    return navigen::protocol::ULTRASONIC_INVALID;
  }
  const uint32_t distance_mm = static_cast<uint32_t>(pulse_us * 0.1715F);
  return static_cast<uint16_t>(
      distance_mm >= navigen::protocol::ULTRASONIC_INVALID
          ? navigen::protocol::ULTRASONIC_INVALID - 1
          : distance_mm);
}

uint16_t batteryMillivolts() {
#if BATTERY_MONITOR_ENABLED
  if (!configuration_valid) {
    return 0;
  }
  const float adc_mv = static_cast<float>(analogRead(PIN_BATTERY_ADC)) *
                       static_cast<float>(ADC_FULL_SCALE_MV) / 1023.0F;
  return static_cast<uint16_t>(navigen::control::clamp<long>(
      std::lround(adc_mv * BATTERY_DIVIDER), 0L, 65535L));
#else
  return 0;
#endif
}

void sendTelemetry(uint32_t now_us, uint32_t now_ms) {
  navigen::protocol::Telemetry telemetry;
  // No encoder exists: measured velocity and tick fields must remain zero.
  telemetry.left_velocity_mmps = 0;
  telemetry.right_velocity_mmps = 0;
  telemetry.left_pwm = left_pwm;
  telemetry.right_pwm = right_pwm;
  telemetry.left_ticks = 0;
  telemetry.right_ticks = 0;
  telemetry.battery_mv = batteryMillivolts();
  // Protocol slot 1 carries the single centered sensor; slot 2 stays invalid.
  telemetry.ultrasonic_left_mm = ultrasonicDistanceMm(now_us);
  telemetry.ultrasonic_right_mm = navigen::protocol::ULTRASONIC_INVALID;
  telemetry.flags = navigen::protocol::FLAG_OPEN_LOOP;
  if (software_estop || physicalEstopActive()) {
    telemetry.flags |= navigen::protocol::FLAG_ESTOP;
  }
  if (watchdog.expired(now_ms)) {
    telemetry.flags |= navigen::protocol::FLAG_WATCHDOG;
  }
  if (!configuration_valid) {
    telemetry.flags |= navigen::protocol::FLAG_CONFIG_INVALID;
  }
  telemetry.acknowledged_sequence = acknowledged_sequence;
  telemetry.command_age_ms = watchdog.ageMs(now_ms);
  telemetry.rx_crc_errors = parser.crc_errors;
  std::array<uint8_t, navigen::protocol::MAX_FRAME_SIZE> output{};
  const std::size_t size = navigen::protocol::encodeTelemetry(
      telemetry, telemetry_sequence++, output.data(), output.size());
  if (size > 0) {
    Serial.write(output.data(), size);
  }
}

}  // namespace

void setup() {
  Serial.begin(SERIAL_BAUD);
  configuration_valid = validateConfiguration();
  if (configuration_valid) {
    configureHardware();
  }
  const uint32_t now_us = micros();
  last_control_us = now_us;
  last_telemetry_us = now_us;
}

void loop() {
  const uint32_t now_us = micros();
  const uint32_t now_ms = millis();
  processSerial(now_ms);
  if (stopRequired(now_ms)) {
    disablePropulsion();
  }
  serviceUltrasonic(now_ms);
  if (static_cast<uint32_t>(now_us - last_control_us) >= CONTROL_PERIOD_US) {
    last_control_us = now_us;
    runControl(now_ms);
  }
  if (static_cast<uint32_t>(now_us - last_telemetry_us) >= TELEMETRY_PERIOD_US) {
    last_telemetry_us = now_us;
    sendTelemetry(now_us, now_ms);
  }
  delay(1);
}
