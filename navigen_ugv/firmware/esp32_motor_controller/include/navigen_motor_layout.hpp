// Hardware-independent helpers for supported H-bridge output layouts.
#pragma once

#include <cstddef>

namespace navigen::control {

constexpr bool motorOutputChannelCountSupported(std::size_t channel_count) {
  return channel_count == 2U || channel_count == 4U;
}

constexpr std::size_t motorChannelsPerSide(std::size_t channel_count) {
  return motorOutputChannelCountSupported(channel_count) ? channel_count / 2U
                                                          : 0U;
}

constexpr std::size_t sideMotorChannelIndex(std::size_t channel_count,
                                            bool right_side,
                                            std::size_t index_on_side) {
  return (right_side ? motorChannelsPerSide(channel_count) : 0U) +
         index_on_side;
}

}  // namespace navigen::control
