// Versioned, CRC-protected serial protocol shared with navigen_hardware/serial_protocol.py.
#pragma once

#include <array>
#include <cstddef>
#include <cstdint>
#include <cstring>

namespace navigen::protocol {

constexpr uint8_t SYNC_FIRST = 0xAA;
constexpr uint8_t SYNC_SECOND = 0x55;
constexpr uint8_t VERSION = 1;
constexpr std::size_t HEADER_SIZE = 5;
constexpr std::size_t MAX_PAYLOAD_SIZE = 64;
constexpr std::size_t MAX_FRAME_SIZE = 2 + HEADER_SIZE + MAX_PAYLOAD_SIZE + 1;

constexpr uint8_t MSG_CMD_VELOCITY = 0x01;
constexpr uint8_t MSG_CMD_ESTOP = 0x02;
constexpr uint8_t MSG_TELEMETRY = 0x10;

constexpr uint8_t FLAG_ESTOP = 0x01;
constexpr uint8_t FLAG_WATCHDOG = 0x02;
constexpr uint8_t FLAG_CONFIG_INVALID = 0x04;
constexpr uint16_t ULTRASONIC_INVALID = 0xFFFF;

inline uint8_t crc8(const uint8_t* data, std::size_t size) {
  uint8_t crc = 0;
  for (std::size_t index = 0; index < size; ++index) {
    crc ^= data[index];
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc & 0x80U) != 0U
                ? static_cast<uint8_t>((crc << 1U) ^ 0x07U)
                : static_cast<uint8_t>(crc << 1U);
    }
  }
  return crc;
}

inline uint16_t readUint16(const uint8_t* data) {
  return static_cast<uint16_t>(data[0]) |
         static_cast<uint16_t>(static_cast<uint16_t>(data[1]) << 8U);
}

inline int16_t readInt16(const uint8_t* data) {
  return static_cast<int16_t>(readUint16(data));
}

inline bool isNewerSequence(uint16_t candidate, uint16_t previous) {
  const uint16_t delta = static_cast<uint16_t>(candidate - previous);
  return delta != 0U && delta < 0x8000U;
}

inline void writeUint16(uint8_t* data, uint16_t value) {
  data[0] = static_cast<uint8_t>(value & 0xFFU);
  data[1] = static_cast<uint8_t>((value >> 8U) & 0xFFU);
}

inline void writeUint32(uint8_t* data, uint32_t value) {
  data[0] = static_cast<uint8_t>(value & 0xFFU);
  data[1] = static_cast<uint8_t>((value >> 8U) & 0xFFU);
  data[2] = static_cast<uint8_t>((value >> 16U) & 0xFFU);
  data[3] = static_cast<uint8_t>((value >> 24U) & 0xFFU);
}

struct Frame {
  uint8_t message_id{0};
  uint16_t sequence{0};
  uint8_t payload_size{0};
  std::array<uint8_t, MAX_PAYLOAD_SIZE> payload{};
};

inline std::size_t encodeFrame(uint8_t message_id, uint16_t sequence,
                               const uint8_t* payload, uint8_t payload_size,
                               uint8_t* output, std::size_t capacity) {
  const std::size_t frame_size = 2 + HEADER_SIZE + payload_size + 1;
  if (payload_size > MAX_PAYLOAD_SIZE || capacity < frame_size) {
    return 0;
  }
  output[0] = SYNC_FIRST;
  output[1] = SYNC_SECOND;
  output[2] = VERSION;
  output[3] = message_id;
  writeUint16(output + 4, sequence);
  output[6] = payload_size;
  if (payload_size > 0 && payload != nullptr) {
    std::memcpy(output + 7, payload, payload_size);
  }
  output[7 + payload_size] = crc8(output + 2, HEADER_SIZE + payload_size);
  return frame_size;
}

class FrameParser {
 public:
  bool feed(uint8_t byte, Frame& frame) {
    if (state_ == State::WAIT_FIRST) {
      if (byte == SYNC_FIRST) {
        state_ = State::WAIT_SECOND;
      } else {
        ++discarded_bytes;
      }
      return false;
    }
    if (state_ == State::WAIT_SECOND) {
      if (byte == SYNC_SECOND) {
        state_ = State::READ_BODY;
        body_size_ = 0;
        expected_size_ = 0;
      } else if (byte != SYNC_FIRST) {
        state_ = State::WAIT_FIRST;
        ++discarded_bytes;
      }
      return false;
    }

    if (body_size_ >= body_.size()) {
      ++length_errors;
      restart(byte);
      return false;
    }
    body_[body_size_++] = byte;
    if (body_size_ == HEADER_SIZE) {
      if (body_[0] != VERSION) {
        ++version_errors;
        restart(byte);
        return false;
      }
      if (body_[4] > MAX_PAYLOAD_SIZE) {
        ++length_errors;
        restart(byte);
        return false;
      }
      expected_size_ = HEADER_SIZE + body_[4] + 1;
    }
    if (expected_size_ == 0 || body_size_ < expected_size_) {
      return false;
    }

    const bool valid_crc =
        crc8(body_.data(), expected_size_ - 1) == body_[expected_size_ - 1];
    if (!valid_crc) {
      ++crc_errors;
      restart(byte);
      return false;
    }
    frame.message_id = body_[1];
    frame.sequence = readUint16(body_.data() + 2);
    frame.payload_size = body_[4];
    if (frame.payload_size > 0) {
      std::memcpy(frame.payload.data(), body_.data() + HEADER_SIZE,
                  frame.payload_size);
    }
    state_ = State::WAIT_FIRST;
    body_size_ = 0;
    expected_size_ = 0;
    return true;
  }

  uint16_t crc_errors{0};
  uint16_t version_errors{0};
  uint16_t length_errors{0};
  uint32_t discarded_bytes{0};

 private:
  enum class State { WAIT_FIRST, WAIT_SECOND, READ_BODY };

  void restart(uint8_t last_byte) {
    state_ = last_byte == SYNC_FIRST ? State::WAIT_SECOND : State::WAIT_FIRST;
    body_size_ = 0;
    expected_size_ = 0;
  }

  State state_{State::WAIT_FIRST};
  std::array<uint8_t, HEADER_SIZE + MAX_PAYLOAD_SIZE + 1> body_{};
  std::size_t body_size_{0};
  std::size_t expected_size_{0};
};

inline bool decodeVelocity(const Frame& frame, float& left_mps,
                           float& right_mps) {
  if (frame.message_id != MSG_CMD_VELOCITY || frame.payload_size != 4) {
    return false;
  }
  left_mps = static_cast<float>(readInt16(frame.payload.data())) / 1000.0F;
  right_mps = static_cast<float>(readInt16(frame.payload.data() + 2)) / 1000.0F;
  return true;
}

inline bool decodeEstop(const Frame& frame, bool& active) {
  if (frame.message_id != MSG_CMD_ESTOP || frame.payload_size != 1 ||
      frame.payload[0] > 1) {
    return false;
  }
  active = frame.payload[0] != 0;
  return true;
}

struct Telemetry {
  int16_t left_velocity_mmps{0};
  int16_t right_velocity_mmps{0};
  int16_t left_pwm{0};
  int16_t right_pwm{0};
  int32_t left_ticks{0};
  int32_t right_ticks{0};
  uint16_t battery_mv{0};
  uint16_t ultrasonic_left_mm{ULTRASONIC_INVALID};
  uint16_t ultrasonic_right_mm{ULTRASONIC_INVALID};
  uint8_t flags{FLAG_CONFIG_INVALID};
  uint16_t acknowledged_sequence{0};
  uint16_t command_age_ms{0xFFFF};
  uint16_t rx_crc_errors{0};
};

inline std::size_t encodeTelemetry(const Telemetry& telemetry, uint16_t sequence,
                                   uint8_t* output, std::size_t capacity) {
  constexpr uint8_t payload_size = 29;
  uint8_t payload[payload_size]{};
  std::size_t offset = 0;
  auto append16 = [&](uint16_t value) {
    writeUint16(payload + offset, value);
    offset += 2;
  };
  auto append32 = [&](uint32_t value) {
    writeUint32(payload + offset, value);
    offset += 4;
  };
  append16(static_cast<uint16_t>(telemetry.left_velocity_mmps));
  append16(static_cast<uint16_t>(telemetry.right_velocity_mmps));
  append16(static_cast<uint16_t>(telemetry.left_pwm));
  append16(static_cast<uint16_t>(telemetry.right_pwm));
  append32(static_cast<uint32_t>(telemetry.left_ticks));
  append32(static_cast<uint32_t>(telemetry.right_ticks));
  append16(telemetry.battery_mv);
  append16(telemetry.ultrasonic_left_mm);
  append16(telemetry.ultrasonic_right_mm);
  payload[offset++] = telemetry.flags;
  append16(telemetry.acknowledged_sequence);
  append16(telemetry.command_age_ms);
  append16(telemetry.rx_crc_errors);
  return encodeFrame(MSG_TELEMETRY, sequence, payload, payload_size, output,
                     capacity);
}

}  // namespace navigen::protocol
