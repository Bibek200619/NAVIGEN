// Hardware-independent motor-control primitives used by firmware and native tests.
#pragma once

#include <cmath>
#include <cstdint>
#include <limits>

namespace navigen::control {

template <typename T>
constexpr T clamp(T value, T low, T high) {
  return value < low ? low : (value > high ? high : value);
}

inline int32_t encoderDelta(int32_t current, int32_t previous) {
  int64_t delta = static_cast<int64_t>(current) - static_cast<int64_t>(previous);
  if (delta > std::numeric_limits<int32_t>::max()) {
    delta -= (static_cast<int64_t>(1) << 32);
  } else if (delta < std::numeric_limits<int32_t>::min()) {
    delta += (static_cast<int64_t>(1) << 32);
  }
  return static_cast<int32_t>(delta);
}

class PidController {
 public:
  PidController(float kp, float ki, float kd, float output_limit)
      : kp_(kp), ki_(ki), kd_(kd), output_limit_(std::fabs(output_limit)) {}

  float update(float setpoint, float measured, float dt) {
    if (!(dt > 0.0F) || !std::isfinite(dt) || !std::isfinite(setpoint) ||
        !std::isfinite(measured) || output_limit_ <= 0.0F) {
      reset();
      return 0.0F;
    }
    const float error = setpoint - measured;
    const float derivative = initialized_ ? (error - previous_error_) / dt : 0.0F;
    const float candidate_integral = integral_ + ki_ * error * dt;
    const float candidate = kp_ * error + candidate_integral + kd_ * derivative;
    const bool saturated_high = candidate > output_limit_ && error > 0.0F;
    const bool saturated_low = candidate < -output_limit_ && error < 0.0F;
    if (!saturated_high && !saturated_low) {
      integral_ = candidate_integral;
    }
    previous_error_ = error;
    initialized_ = true;
    return clamp(kp_ * error + integral_ + kd_ * derivative, -output_limit_,
                 output_limit_);
  }

  void reset() {
    integral_ = 0.0F;
    previous_error_ = 0.0F;
    initialized_ = false;
  }

  float integral() const { return integral_; }

 private:
  float kp_;
  float ki_;
  float kd_;
  float output_limit_;
  float integral_{0.0F};
  float previous_error_{0.0F};
  bool initialized_{false};
};

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

class EncoderVelocityEstimator {
 public:
  EncoderVelocityEstimator(float wheel_radius_m, float ticks_per_revolution)
      : metres_per_tick_(2.0F * 3.14159265358979323846F * wheel_radius_m /
                         ticks_per_revolution) {}

  float update(int32_t ticks, float dt) {
    if (!initialized_) {
      previous_ticks_ = ticks;
      initialized_ = true;
      return 0.0F;
    }
    if (!(dt > 0.0F) || !std::isfinite(dt)) {
      return 0.0F;
    }
    const int32_t delta = encoderDelta(ticks, previous_ticks_);
    previous_ticks_ = ticks;
    return static_cast<float>(delta) * metres_per_tick_ / dt;
  }

 private:
  float metres_per_tick_;
  int32_t previous_ticks_{0};
  bool initialized_{false};
};

}  // namespace navigen::control
