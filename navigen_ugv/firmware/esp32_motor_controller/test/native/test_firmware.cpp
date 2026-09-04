#include <array>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <limits>

#include "navigen_control.hpp"
#include "navigen_motor_layout.hpp"
#include "navigen_protocol.hpp"

namespace {

void testGoldenVelocityFrame() {
  const uint8_t payload[] = {0xFA, 0x00, 0x06, 0xFF};  // +0.250, -0.250 m/s
  std::array<uint8_t, navigen::protocol::MAX_FRAME_SIZE> encoded{};
  const std::size_t size = navigen::protocol::encodeFrame(
      navigen::protocol::MSG_CMD_VELOCITY, 0x1234, payload, sizeof(payload),
      encoded.data(), encoded.size());
  const uint8_t expected[] = {0xAA, 0x55, 0x01, 0x01, 0x34, 0x12,
                              0x04, 0xFA, 0x00, 0x06, 0xFF, 0x3C};
  assert(size == sizeof(expected));
  for (std::size_t index = 0; index < size; ++index) {
    assert(encoded[index] == expected[index]);
  }

  navigen::protocol::FrameParser parser;
  navigen::protocol::Frame frame;
  bool parsed = false;
  for (std::size_t index = 0; index < size; ++index) {
    parsed = parser.feed(encoded[index], frame) || parsed;
  }
  assert(parsed);
  float left = 0.0F;
  float right = 0.0F;
  assert(navigen::protocol::decodeVelocity(frame, left, right));
  assert(std::fabs(left - 0.25F) < 0.0001F);
  assert(std::fabs(right + 0.25F) < 0.0001F);
}

void testParserRejectsCrcAndRecovers() {
  const uint8_t payload[] = {1};
  std::array<uint8_t, navigen::protocol::MAX_FRAME_SIZE> encoded{};
  const std::size_t size = navigen::protocol::encodeFrame(
      navigen::protocol::MSG_CMD_ESTOP, 9, payload, sizeof(payload),
      encoded.data(), encoded.size());
  navigen::protocol::FrameParser parser;
  navigen::protocol::Frame frame;
  encoded[size - 1] ^= 0x01;
  for (std::size_t index = 0; index < size; ++index) {
    assert(!parser.feed(encoded[index], frame));
  }
  assert(parser.crc_errors == 1);

  encoded[size - 1] ^= 0x01;
  bool parsed = false;
  for (std::size_t index = 0; index < size; ++index) {
    parsed = parser.feed(encoded[index], frame) || parsed;
  }
  assert(parsed);
  bool active = false;
  assert(navigen::protocol::decodeEstop(frame, active));
  assert(active);
}

void testSequenceOrderingAcrossRollover() {
  assert(navigen::protocol::isNewerSequence(11, 10));
  assert(!navigen::protocol::isNewerSequence(10, 10));
  assert(!navigen::protocol::isNewerSequence(9, 10));
  assert(navigen::protocol::isNewerSequence(0, 0xFFFF));
}

void testTelemetryRoundTripFrame() {
  navigen::protocol::Telemetry telemetry;
  telemetry.left_velocity_mmps = 125;
  telemetry.right_velocity_mmps = -75;
  telemetry.left_ticks = 123456;
  telemetry.right_ticks = -654321;
  telemetry.battery_mv = 12100;
  telemetry.ultrasonic_left_mm = 450;
  telemetry.flags = navigen::protocol::FLAG_WATCHDOG;
  telemetry.acknowledged_sequence = 77;
  telemetry.command_age_ms = 301;
  telemetry.rx_crc_errors = 2;
  std::array<uint8_t, navigen::protocol::MAX_FRAME_SIZE> encoded{};
  const std::size_t size = navigen::protocol::encodeTelemetry(
      telemetry, 12, encoded.data(), encoded.size());
  assert(size == 37);
  navigen::protocol::FrameParser parser;
  navigen::protocol::Frame frame;
  bool parsed = false;
  for (std::size_t index = 0; index < size; ++index) {
    parsed = parser.feed(encoded[index], frame) || parsed;
  }
  assert(parsed);
  assert(frame.message_id == navigen::protocol::MSG_TELEMETRY);
  assert(frame.payload_size == 29);
  assert(navigen::protocol::readInt16(frame.payload.data()) == 125);
  assert(navigen::protocol::readInt16(frame.payload.data() + 2) == -75);
  assert(navigen::protocol::readUint16(frame.payload.data() + 16) == 12100);
}

void testPidLimitsAndAntiWindup() {
  navigen::control::PidController pid(100.0F, 30.0F, 0.0F, 255.0F);
  const float first = pid.update(1.0F, 0.0F, 0.01F);
  assert(first > 0.0F && first <= 255.0F);
  for (int iteration = 0; iteration < 1000; ++iteration) {
    assert(pid.update(100.0F, 0.0F, 0.01F) <= 255.0F);
  }
  assert(pid.integral() < 10.0F);
  assert(pid.update(0.0F, 1.0F, 0.01F) < 0.0F);
  pid.reset();
  assert(pid.integral() == 0.0F);
}

void testWatchdogAndUnsignedRollover() {
  navigen::control::CommandWatchdog watchdog(300);
  assert(watchdog.expired(0));
  watchdog.noteCommand(1000);
  assert(!watchdog.expired(1300));
  assert(watchdog.expired(1301));

  navigen::control::CommandWatchdog rollover_watchdog(100);
  rollover_watchdog.noteCommand(std::numeric_limits<uint32_t>::max() - 50U);
  assert(!rollover_watchdog.expired(25U));
  assert(rollover_watchdog.expired(60U));
}

void testEncoderVelocityAndTickRollover() {
  navigen::control::EncoderVelocityEstimator estimator(0.1F, 100.0F);
  assert(estimator.update(0, 0.1F) == 0.0F);
  const float velocity = estimator.update(10, 0.1F);
  assert(std::fabs(velocity - 0.6283185F) < 0.0001F);
  assert(navigen::control::encoderDelta(
             std::numeric_limits<int32_t>::min(),
             std::numeric_limits<int32_t>::max()) == 1);
}

void testSupportedMotorLayouts() {
  using navigen::control::motorChannelsPerSide;
  using navigen::control::motorOutputChannelCountSupported;
  using navigen::control::sideMotorChannelIndex;

  assert(motorOutputChannelCountSupported(2));
  assert(motorChannelsPerSide(2) == 1);
  assert(sideMotorChannelIndex(2, false, 0) == 0);
  assert(sideMotorChannelIndex(2, true, 0) == 1);

  assert(motorOutputChannelCountSupported(4));
  assert(motorChannelsPerSide(4) == 2);
  assert(sideMotorChannelIndex(4, false, 0) == 0);
  assert(sideMotorChannelIndex(4, false, 1) == 1);
  assert(sideMotorChannelIndex(4, true, 0) == 2);
  assert(sideMotorChannelIndex(4, true, 1) == 3);

  assert(!motorOutputChannelCountSupported(0));
  assert(!motorOutputChannelCountSupported(3));
  assert(motorChannelsPerSide(3) == 0);
}

}  // namespace

int main() {
  testGoldenVelocityFrame();
  testParserRejectsCrcAndRecovers();
  testSequenceOrderingAcrossRollover();
  testTelemetryRoundTripFrame();
  testPidLimitsAndAntiWindup();
  testWatchdogAndUnsignedRollover();
  testEncoderVelocityAndTickRollover();
  testSupportedMotorLayouts();
  std::cout << "Firmware native tests passed\n";
  return 0;
}
