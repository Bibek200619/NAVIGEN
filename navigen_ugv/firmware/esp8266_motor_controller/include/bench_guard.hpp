#pragma once

#include <cstdint>

namespace navigen {

class BenchWindow {
 public:
  explicit BenchWindow(uint32_t limit_ms) : limit_ms_(limit_ms) {}

  void noteOutput(uint32_t now_ms, int16_t left_pwm, int16_t right_pwm) {
    if (!started_ && (left_pwm != 0 || right_pwm != 0)) {
      started_ = true;
      started_ms_ = now_ms;
    }
  }

  bool expired(uint32_t now_ms) const {
    return started_ && static_cast<uint32_t>(now_ms - started_ms_) >= limit_ms_;
  }

 private:
  uint32_t limit_ms_;
  uint32_t started_ms_{0};
  bool started_{false};
};

}  // namespace navigen
