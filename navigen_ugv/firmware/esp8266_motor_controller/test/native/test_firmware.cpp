#include <array>
#include <cassert>
#include <cmath>
#include <cstdint>
#include <iostream>
#include <limits>

#include "navigen_control.hpp"
#include "navigen_protocol.hpp"

namespace {

void testGoldenVelocityFrame() {
  const uint8_t payload[] = {0xFA, 0x00, 0x06, 0xFF};  // +0.250, -0.250 m/s
  std::array<uint8_t, navigen::protocol::MAX_FRAME_SIZE> encoded{};
  const std::size_t size = navigen::protocol::encodeFrame(
      navigen::protocol::MSG_CMD_VELOCITY, 0x1234, payload, sizeof(payload),
      encoded.data(), encoded.size());
  const uint8_t expected[] = {0xAA, 0x55, 0x02, 0x01, 0x34, 0x12,
                              0x04, 0xFA, 0x00, 0x06, 0xFF, 0xB7};
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
  telemetry.left_velocity_mmps = 0;
  telemetry.right_velocity_mmps = 0;
  telemetry.left_ticks = 0;
  telemetry.right_ticks = 0;
  telemetry.battery_mv = 12100;
  telemetry.ultrasonic_left_mm = 450;
  telemetry.flags = navigen::protocol::FLAG_WATCHDOG |
                    navigen::protocol::FLAG_OPEN_LOOP;
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
  assert(navigen::protocol::readInt16(frame.payload.data()) == 0);
  assert(navigen::protocol::readInt16(frame.payload.data() + 2) == 0);
  assert(navigen::protocol::readUint16(frame.payload.data() + 16) == 12100);
}

void testOpenLoopVelocityMapping() {
  using navigen::control::openLoopVelocityToPwm;
  assert(openLoopVelocityToPwm(0.0F, 0.4F, 0, 255, 0.01F) == 0);
  assert(openLoopVelocityToPwm(0.01F, 0.4F, 0, 255, 0.01F) == 0);
  assert(openLoopVelocityToPwm(0.2F, 0.4F, 0, 255, 0.01F) == 128);
  assert(openLoopVelocityToPwm(-0.2F, 0.4F, 0, 255, 0.01F) == -128);
  assert(openLoopVelocityToPwm(1.0F, 0.4F, 40, 255, 0.01F) == 255);
  assert(openLoopVelocityToPwm(0.1F, 0.4F, 40, 200, 0.01F) == 80);
  assert(openLoopVelocityToPwm(NAN, 0.4F, 0, 255, 0.01F) == 0);
  assert(openLoopVelocityToPwm(0.2F, 0.0F, 0, 255, 0.01F) == 0);
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

}  // namespace

int main() {
  testGoldenVelocityFrame();
  testParserRejectsCrcAndRecovers();
  testSequenceOrderingAcrossRollover();
  testTelemetryRoundTripFrame();
  testOpenLoopVelocityMapping();
  testWatchdogAndUnsignedRollover();
  std::cout << "Firmware native tests passed\n";
  return 0;
}
