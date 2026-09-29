#pragma once

#include <cstdint>
#include "navigen_protocol.hpp"

namespace navigen {
inline bool rearBlocks(float left_target, float right_target, uint16_t range_mm,
                       uint16_t stop_mm) {
  return (left_target < 0.0F || right_target < 0.0F) &&
         (range_mm == protocol::ULTRASONIC_INVALID || range_mm <= stop_mm);
}
}  // namespace navigen
