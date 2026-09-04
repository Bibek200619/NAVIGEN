// Hardware-independent motor-control primitives used by firmware and native tests.
#pragma once

#include <cmath>
#include <cstdint>

namespace navigen::control {

template <typename T>
constexpr T clamp(T value, T low, T high) {
  return value < low ? low : (value > high ? high : value);
}

inline int16_t openLoopVelocityToPwm(float target_mps, float max_velocity_mps,
                                     int16_t minimum_pwm, int16_t maximum_pwm,
                                     float deadband_mps) {
  if (!std::isfinite(target_mps) || !std::isfinite(max_velocity_mps) ||
      !std::isfinite(deadband_mps) || max_velocity_mps <= 0.0F ||
      deadband_mps < 0.0F || minimum_pwm < 0 || maximum_pwm <= 0 ||
      minimum_pwm > maximum_pwm || std::fabs(target_mps) <= deadband_mps) {
    return 0;
  }
  const float magnitude = clamp(std::fabs(target_mps) / max_velocity_mps,
                                0.0F, 1.0F);
  const float span = static_cast<float>(maximum_pwm - minimum_pwm);
  const int16_t output = static_cast<int16_t>(
      std::lround(static_cast<float>(minimum_pwm) + magnitude * span));
  return target_mps > 0.0F ? output : static_cast<int16_t>(-output);
}

class CommandWatchdog {
 public:
  explicit CommandWatchdog(uint32_t timeout_ms) : timeout_ms_(timeout_ms) {}

  void noteCommand(uint32_t now_ms) {
    last_command_ms_ = now_ms;
    seen_command_ = true;
  }

  bool expired(uint32_t now_ms) const {
    return !seen_command_ ||
           static_cast<uint32_t>(now_ms - last_command_ms_) > timeout_ms_;
  }

  uint16_t ageMs(uint32_t now_ms) const {
    if (!seen_command_) {
      return 0xFFFF;
    }
    const uint32_t age = static_cast<uint32_t>(now_ms - last_command_ms_);
    return static_cast<uint16_t>(age > 0xFFFFU ? 0xFFFFU : age);
  }

 private:
  uint32_t timeout_ms_;
  uint32_t last_command_ms_{0};
  bool seen_command_{false};
};

}  // namespace navigen::control
