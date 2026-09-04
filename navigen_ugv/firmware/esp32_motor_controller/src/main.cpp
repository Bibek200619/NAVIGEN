#include <Arduino.h>

#include <array>
#include <cmath>
#include <cstdint>

#include "board_config.h"
#include "navigen_control.hpp"
#include "navigen_motor_layout.hpp"
#include "navigen_protocol.hpp"

namespace {

using navigen::control::CommandWatchdog;
using navigen::control::EncoderVelocityEstimator;
using navigen::control::PidController;
using navigen::protocol::Frame;
using navigen::protocol::FrameParser;

constexpr uint32_t CONTROL_PERIOD_US = 1000000UL / MOTOR_PID_RATE_HZ;
constexpr uint32_t TELEMETRY_PERIOD_US = 1000000UL / TELEMETRY_RATE_HZ;
constexpr float SAFE_WHEEL_RADIUS_M = WHEEL_RADIUS_M > 0.0F ? WHEEL_RADIUS_M : 1.0F;
constexpr float SAFE_TICKS_PER_REV = TICKS_PER_REV > 0.0F ? TICKS_PER_REV : 1.0F;
static_assert(navigen::control::motorOutputChannelCountSupported(
                  MOTOR_OUTPUT_CHANNEL_COUNT),
              "MOTOR_OUTPUT_CHANNEL_COUNT must be 2 or 4");
constexpr std::size_t MOTOR_CHANNELS_PER_SIDE =
    navigen::control::motorChannelsPerSide(MOTOR_OUTPUT_CHANNEL_COUNT);

struct MotorChannel {
  int pwm_pin;
  int dir_a_pin;
  int dir_b_pin;
  uint8_t pwm_channel;
  bool inverted;
};

struct EncoderChannel {
  int pin_a;
  int pin_b;
  bool inverted;
  volatile int32_t ticks{0};
  volatile uint8_t previous_state{0};
};

struct UltrasonicCapture {
  int trigger_pin;
  int echo_pin;
  volatile uint32_t rise_us{0};
  volatile uint32_t pulse_us{0};
  volatile uint32_t update_us{0};
};

#if MOTOR_OUTPUT_CHANNEL_COUNT == 2
MotorChannel motor_left{PIN_MOTOR_LEFT_PWM, PIN_MOTOR_LEFT_DIR_A,
                        PIN_MOTOR_LEFT_DIR_B, MOTOR_LEFT_PWM_CHANNEL,
                        MOTOR_LEFT_INVERTED != 0};
MotorChannel motor_right{PIN_MOTOR_RIGHT_PWM, PIN_MOTOR_RIGHT_DIR_A,
                         PIN_MOTOR_RIGHT_DIR_B, MOTOR_RIGHT_PWM_CHANNEL,
                         MOTOR_RIGHT_INVERTED != 0};
std::array<MotorChannel*, 2> motor_channels{{&motor_left, &motor_right}};
#elif MOTOR_OUTPUT_CHANNEL_COUNT == 4
MotorChannel motor_lf{PIN_MOTOR_LF_PWM, PIN_MOTOR_LF_DIR_A,
                      PIN_MOTOR_LF_DIR_B, MOTOR_LF_PWM_CHANNEL,
                      MOTOR_LF_INVERTED != 0};
MotorChannel motor_lr{PIN_MOTOR_LR_PWM, PIN_MOTOR_LR_DIR_A,
                      PIN_MOTOR_LR_DIR_B, MOTOR_LR_PWM_CHANNEL,
                      MOTOR_LR_INVERTED != 0};
MotorChannel motor_rf{PIN_MOTOR_RF_PWM, PIN_MOTOR_RF_DIR_A,
                      PIN_MOTOR_RF_DIR_B, MOTOR_RF_PWM_CHANNEL,
                      MOTOR_RF_INVERTED != 0};
MotorChannel motor_rr{PIN_MOTOR_RR_PWM, PIN_MOTOR_RR_DIR_A,
                      PIN_MOTOR_RR_DIR_B, MOTOR_RR_PWM_CHANNEL,
                      MOTOR_RR_INVERTED != 0};
std::array<MotorChannel*, 4> motor_channels{
    {&motor_lf, &motor_lr, &motor_rf, &motor_rr}};
#endif

EncoderChannel encoder_lf{PIN_ENCODER_LF_A, PIN_ENCODER_LF_B,
                          ENCODER_LF_INVERTED != 0};
EncoderChannel encoder_lr{PIN_ENCODER_LR_A, PIN_ENCODER_LR_B,
                          ENCODER_LR_INVERTED != 0};
EncoderChannel encoder_rf{PIN_ENCODER_RF_A, PIN_ENCODER_RF_B,
                          ENCODER_RF_INVERTED != 0};
EncoderChannel encoder_rr{PIN_ENCODER_RR_A, PIN_ENCODER_RR_B,
                          ENCODER_RR_INVERTED != 0};

UltrasonicCapture ultrasonic_left{PIN_US_LEFT_TRIG, PIN_US_LEFT_ECHO};
UltrasonicCapture ultrasonic_right{PIN_US_RIGHT_TRIG, PIN_US_RIGHT_ECHO};

portMUX_TYPE encoder_mux = portMUX_INITIALIZER_UNLOCKED;
portMUX_TYPE ultrasonic_mux = portMUX_INITIALIZER_UNLOCKED;

FrameParser parser;
CommandWatchdog watchdog(WATCHDOG_TIMEOUT_MS);
PidController left_pid(LEFT_PID_KP, LEFT_PID_KI, LEFT_PID_KD, MAX_PWM);
PidController right_pid(RIGHT_PID_KP, RIGHT_PID_KI, RIGHT_PID_KD, MAX_PWM);
EncoderVelocityEstimator left_velocity_estimator(SAFE_WHEEL_RADIUS_M,
                                                  SAFE_TICKS_PER_REV);
EncoderVelocityEstimator right_velocity_estimator(SAFE_WHEEL_RADIUS_M,
                                                   SAFE_TICKS_PER_REV);

bool configuration_valid = false;
bool hardware_ready = false;
bool software_estop = false;
bool host_sequence_seen = false;
uint16_t last_host_sequence = 0;
uint16_t acknowledged_sequence = 0;
uint16_t telemetry_sequence = 0;
float left_target_mps = 0.0F;
float right_target_mps = 0.0F;
float left_measured_mps = 0.0F;
float right_measured_mps = 0.0F;
int16_t left_pwm = 0;
int16_t right_pwm = 0;
int32_t left_ticks = 0;
int32_t right_ticks = 0;
uint32_t last_control_us = 0;
uint32_t last_telemetry_us = 0;
uint32_t last_ultrasonic_ms = 0;
bool trigger_left_next = true;

bool encoderPairConfigured(const EncoderChannel& encoder) {
  return encoder.pin_a >= 0 && encoder.pin_b >= 0;
}

bool encoderPairSane(const EncoderChannel& encoder) {
  return (encoder.pin_a >= 0) == (encoder.pin_b >= 0);
}

bool pinsAreUnique() {
  std::array<int, 27> pins{};
  std::size_t count = 0;
  auto add = [&](int pin) {
    if (pin >= 0) {
      pins[count++] = pin;
    }
  };
  for (const MotorChannel* motor : motor_channels) {
    add(motor->pwm_pin);
    add(motor->dir_a_pin);
    add(motor->dir_b_pin);
  }
  for (const EncoderChannel* encoder :
       {&encoder_lf, &encoder_lr, &encoder_rf, &encoder_rr}) {
    add(encoder->pin_a);
    add(encoder->pin_b);
  }
  add(PIN_US_LEFT_TRIG);
  add(PIN_US_LEFT_ECHO);
  add(PIN_US_RIGHT_TRIG);
  add(PIN_US_RIGHT_ECHO);
  add(PIN_ESTOP_INPUT);
  add(PIN_BATTERY_ADC);
  add(PIN_MOTOR_ENABLE);
  for (std::size_t first = 0; first < count; ++first) {
    for (std::size_t second = first + 1; second < count; ++second) {
      if (pins[first] == pins[second]) {
        return false;
      }
    }
  }
  return true;
}

bool validateConfiguration() {
  bool motors_configured = true;
  bool pwm_channels_unique = true;
  for (std::size_t first = 0; first < motor_channels.size(); ++first) {
    const MotorChannel& motor = *motor_channels[first];
    motors_configured = motors_configured && motor.pwm_pin >= 0 &&
                        motor.dir_a_pin >= 0 && motor.dir_b_pin >= 0;
    for (std::size_t second = first + 1; second < motor_channels.size();
         ++second) {
      if (motor.pwm_channel == motor_channels[second]->pwm_channel) {
        pwm_channels_unique = false;
      }
    }
  }
  const bool encoder_pairs_sane =
      encoderPairSane(encoder_lf) && encoderPairSane(encoder_lr) &&
      encoderPairSane(encoder_rf) && encoderPairSane(encoder_rr);
  const bool encoders_configured =
      (encoderPairConfigured(encoder_lf) || encoderPairConfigured(encoder_lr)) &&
      (encoderPairConfigured(encoder_rf) || encoderPairConfigured(encoder_rr));
  const bool sensors_configured =
      PIN_US_LEFT_TRIG >= 0 && PIN_US_LEFT_ECHO >= 0 &&
      PIN_US_RIGHT_TRIG >= 0 && PIN_US_RIGHT_ECHO >= 0 &&
      PIN_ESTOP_INPUT >= 0 && PIN_BATTERY_ADC >= 0 && BATTERY_DIVIDER > 0.0F;
  const bool control_configured =
      TICKS_PER_REV > 0.0F && WHEEL_RADIUS_M > 0.0F && TRACK_WIDTH_M > 0.0F &&
      MAX_WHEEL_VELOCITY_MPS > 0.0F && LEFT_PID_KP > 0.0F &&
      RIGHT_PID_KP > 0.0F && LEFT_PID_KI >= 0.0F && LEFT_PID_KD >= 0.0F &&
      RIGHT_PID_KI >= 0.0F && RIGHT_PID_KD >= 0.0F && MAX_PWM > 0 &&
      MAX_PWM < (1 << PWM_RESOLUTION_BITS) && MOTOR_PID_RATE_HZ >= 100 &&
      TELEMETRY_RATE_HZ >= 20 && WATCHDOG_TIMEOUT_MS > 0;
  return motors_configured && encoder_pairs_sane && encoders_configured &&
         sensors_configured && control_configured && pwm_channels_unique &&
         pinsAreUnique();
}

void IRAM_ATTR encoderInterrupt(void* argument) {
  auto* encoder = static_cast<EncoderChannel*>(argument);
  const uint8_t current_state =
      static_cast<uint8_t>((digitalRead(encoder->pin_a) << 1U) |
                           digitalRead(encoder->pin_b));
  constexpr int8_t transitions[16] = {0, -1, 1,  0, 1,  0, 0, -1,
                                      -1, 0, 0,  1, 0, 1, -1, 0};
  portENTER_CRITICAL_ISR(&encoder_mux);
  const uint8_t transition =
      static_cast<uint8_t>((encoder->previous_state << 2U) | current_state);
  int8_t delta = transitions[transition];
  if (encoder->inverted) {
    delta = static_cast<int8_t>(-delta);
  }
  encoder->ticks += delta;
  encoder->previous_state = current_state;
  portEXIT_CRITICAL_ISR(&encoder_mux);
}

void IRAM_ATTR ultrasonicInterrupt(void* argument) {
  auto* capture = static_cast<UltrasonicCapture*>(argument);
  const uint32_t now_us = micros();
  const bool high = digitalRead(capture->echo_pin) != 0;
  portENTER_CRITICAL_ISR(&ultrasonic_mux);
  if (high) {
    capture->rise_us = now_us;
  } else {
    capture->pulse_us = static_cast<uint32_t>(now_us - capture->rise_us);
    capture->update_us = now_us;
  }
  portEXIT_CRITICAL_ISR(&ultrasonic_mux);
}

void configureMotor(MotorChannel& motor) {
  pinMode(motor.dir_a_pin, OUTPUT);
  pinMode(motor.dir_b_pin, OUTPUT);
  digitalWrite(motor.dir_a_pin, LOW);
  digitalWrite(motor.dir_b_pin, LOW);
  ledcSetup(motor.pwm_channel, PWM_FREQUENCY_HZ, PWM_RESOLUTION_BITS);
  ledcAttachPin(motor.pwm_pin, motor.pwm_channel);
  ledcWrite(motor.pwm_channel, 0);
}

void configureEncoder(EncoderChannel& encoder) {
  if (!encoderPairConfigured(encoder)) {
    return;
  }
  const uint8_t mode = ENCODER_USE_PULLUPS != 0 ? INPUT_PULLUP : INPUT;
  pinMode(encoder.pin_a, mode);
  pinMode(encoder.pin_b, mode);
  encoder.previous_state =
      static_cast<uint8_t>((digitalRead(encoder.pin_a) << 1U) |
                           digitalRead(encoder.pin_b));
  attachInterruptArg(encoder.pin_a, encoderInterrupt, &encoder, CHANGE);
  attachInterruptArg(encoder.pin_b, encoderInterrupt, &encoder, CHANGE);
}

void configureUltrasonic(UltrasonicCapture& capture) {
  pinMode(capture.trigger_pin, OUTPUT);
  digitalWrite(capture.trigger_pin, LOW);
  pinMode(capture.echo_pin, INPUT);
  attachInterruptArg(capture.echo_pin, ultrasonicInterrupt, &capture, CHANGE);
}

void configureHardware() {
  for (MotorChannel* motor : motor_channels) {
    configureMotor(*motor);
  }
  if (PIN_MOTOR_ENABLE >= 0) {
    pinMode(PIN_MOTOR_ENABLE, OUTPUT);
    digitalWrite(PIN_MOTOR_ENABLE, !MOTOR_ENABLE_LEVEL);
  }
  for (EncoderChannel* encoder :
       {&encoder_lf, &encoder_lr, &encoder_rf, &encoder_rr}) {
    configureEncoder(*encoder);
  }
  configureUltrasonic(ultrasonic_left);
  configureUltrasonic(ultrasonic_right);
  pinMode(PIN_ESTOP_INPUT, ESTOP_USE_PULLUP != 0 ? INPUT_PULLUP : INPUT);
  pinMode(PIN_BATTERY_ADC, INPUT);
  hardware_ready = true;
}

void setDriverEnabled(bool enabled) {
  if (hardware_ready && PIN_MOTOR_ENABLE >= 0) {
    digitalWrite(PIN_MOTOR_ENABLE,
                 enabled ? MOTOR_ENABLE_LEVEL : !MOTOR_ENABLE_LEVEL);
  }
}

void writeMotor(MotorChannel& motor, int16_t requested_pwm) {
  if (!hardware_ready) {
    return;
  }
  int value = navigen::control::clamp<int>(requested_pwm, -MAX_PWM, MAX_PWM);
  if (motor.inverted) {
    value = -value;
  }
  ledcWrite(motor.pwm_channel, 0);
  if (value == 0) {
    digitalWrite(motor.dir_a_pin, MOTOR_ZERO_BRAKE != 0 ? HIGH : LOW);
    digitalWrite(motor.dir_b_pin, MOTOR_ZERO_BRAKE != 0 ? HIGH : LOW);
  } else {
    digitalWrite(motor.dir_a_pin, value > 0 ? HIGH : LOW);
    digitalWrite(motor.dir_b_pin, value > 0 ? LOW : HIGH);
  }
  ledcWrite(motor.pwm_channel, static_cast<uint32_t>(std::abs(value)));
}

void disablePropulsion() {
  if (!hardware_ready) {
    return;
  }
  setDriverEnabled(false);
  for (MotorChannel* motor : motor_channels) {
    writeMotor(*motor, 0);
  }
  left_pwm = 0;
  right_pwm = 0;
}

void writeSideMotors(bool right_side, int16_t requested_pwm) {
  for (std::size_t index = 0; index < MOTOR_CHANNELS_PER_SIDE; ++index) {
    const std::size_t channel_index = navigen::control::sideMotorChannelIndex(
        MOTOR_OUTPUT_CHANNEL_COUNT, right_side, index);
    writeMotor(*motor_channels[channel_index], requested_pwm);
  }
}

bool physicalEstopActive() {
  return configuration_valid &&
         digitalRead(PIN_ESTOP_INPUT) == ESTOP_ACTIVE_LEVEL;
}

bool stopRequired(uint32_t now_ms) {
  return !configuration_valid || software_estop || physicalEstopActive() ||
         watchdog.expired(now_ms);
}

int32_t snapshotEncoderTicks(EncoderChannel& encoder) {
  int32_t ticks = 0;
  portENTER_CRITICAL(&encoder_mux);
  ticks = encoder.ticks;
  portEXIT_CRITICAL(&encoder_mux);
  return ticks;
}

int32_t sideTicks(EncoderChannel& first, EncoderChannel& second) {
  int64_t total = 0;
  int count = 0;
  if (encoderPairConfigured(first)) {
    total += snapshotEncoderTicks(first);
    ++count;
  }
  if (encoderPairConfigured(second)) {
    total += snapshotEncoderTicks(second);
    ++count;
  }
  return count == 0 ? 0 : static_cast<int32_t>(total / count);
}

void runControl(uint32_t now_us, uint32_t now_ms) {
  const float dt = static_cast<float>(now_us - last_control_us) / 1000000.0F;
  last_control_us = now_us;
  left_ticks = sideTicks(encoder_lf, encoder_lr);
  right_ticks = sideTicks(encoder_rf, encoder_rr);
  left_measured_mps = left_velocity_estimator.update(left_ticks, dt);
  right_measured_mps = right_velocity_estimator.update(right_ticks, dt);

  if (stopRequired(now_ms)) {
    left_pid.reset();
    right_pid.reset();
    disablePropulsion();
    return;
  }
  if (std::fabs(left_target_mps) < 0.0005F) {
    left_pid.reset();
    left_pwm = 0;
  } else {
    left_pwm = static_cast<int16_t>(
        std::lround(left_pid.update(left_target_mps, left_measured_mps, dt)));
  }
  if (std::fabs(right_target_mps) < 0.0005F) {
    right_pid.reset();
    right_pwm = 0;
  } else {
    right_pwm = static_cast<int16_t>(
        std::lround(right_pid.update(right_target_mps, right_measured_mps, dt)));
  }
  writeSideMotors(false, left_pwm);
  writeSideMotors(true, right_pwm);
  setDriverEnabled(left_pwm != 0 || right_pwm != 0);
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
    // An asserted e-stop is accepted regardless of sequence because safety wins.
    // A release still requires ordering, except after watchdog expiry (new Pi session).
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

void triggerUltrasonic(UltrasonicCapture& capture) {
  digitalWrite(capture.trigger_pin, LOW);
  delayMicroseconds(2);
  digitalWrite(capture.trigger_pin, HIGH);
  delayMicroseconds(10);
  digitalWrite(capture.trigger_pin, LOW);
}

void serviceUltrasonic(uint32_t now_ms) {
  if (!configuration_valid ||
      static_cast<uint32_t>(now_ms - last_ultrasonic_ms) <
          ULTRASONIC_SAMPLE_PERIOD_MS) {
    return;
  }
  last_ultrasonic_ms = now_ms;
  triggerUltrasonic(trigger_left_next ? ultrasonic_left : ultrasonic_right);
  trigger_left_next = !trigger_left_next;
}

uint16_t ultrasonicDistanceMm(UltrasonicCapture& capture, uint32_t now_us) {
  uint32_t pulse_us = 0;
  uint32_t update_us = 0;
  portENTER_CRITICAL(&ultrasonic_mux);
  pulse_us = capture.pulse_us;
  update_us = capture.update_us;
  portEXIT_CRITICAL(&ultrasonic_mux);
  if (update_us == 0 || pulse_us == 0 || pulse_us > ULTRASONIC_ECHO_TIMEOUT_US ||
      static_cast<uint32_t>(now_us - update_us) > ULTRASONIC_STALE_MS * 1000UL) {
    return navigen::protocol::ULTRASONIC_INVALID;
  }
  const uint32_t distance_mm = static_cast<uint32_t>(pulse_us * 0.1715F);
  return static_cast<uint16_t>(
      distance_mm >= navigen::protocol::ULTRASONIC_INVALID
          ? navigen::protocol::ULTRASONIC_INVALID - 1
          : distance_mm);
}

int16_t velocityMillimetresPerSecond(float velocity) {
  const long value = std::lround(velocity * 1000.0F);
  return static_cast<int16_t>(
      navigen::control::clamp<long>(value, -32768L, 32767L));
}

uint16_t batteryMillivolts() {
  if (!configuration_valid) {
    return 0;
  }
  const float millivolts =
      static_cast<float>(analogReadMilliVolts(PIN_BATTERY_ADC)) * BATTERY_DIVIDER;
  return static_cast<uint16_t>(navigen::control::clamp<long>(
      std::lround(millivolts), 0L, 65535L));
}

void sendTelemetry(uint32_t now_us, uint32_t now_ms) {
  navigen::protocol::Telemetry telemetry;
  telemetry.left_velocity_mmps = velocityMillimetresPerSecond(left_measured_mps);
  telemetry.right_velocity_mmps = velocityMillimetresPerSecond(right_measured_mps);
  telemetry.left_pwm = left_pwm;
  telemetry.right_pwm = right_pwm;
  telemetry.left_ticks = left_ticks;
  telemetry.right_ticks = right_ticks;
  telemetry.battery_mv = batteryMillivolts();
  telemetry.ultrasonic_left_mm = ultrasonicDistanceMm(ultrasonic_left, now_us);
  telemetry.ultrasonic_right_mm = ultrasonicDistanceMm(ultrasonic_right, now_us);
  telemetry.flags = 0;
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
    runControl(now_us, now_ms);
  }
  if (static_cast<uint32_t>(now_us - last_telemetry_us) >= TELEMETRY_PERIOD_US) {
    last_telemetry_us = now_us;
    sendTelemetry(now_us, now_ms);
  }
  delay(1);
}
