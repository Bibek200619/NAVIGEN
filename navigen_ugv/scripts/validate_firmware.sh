#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
UGV_ROOT=$(cd -- "${SCRIPT_DIR}/.." && pwd)
FIRMWARE_ROOT="${UGV_ROOT}/firmware/esp32_motor_controller"
TEST_BINARY=$(mktemp "${TMPDIR:-/tmp}/navigen-firmware-test.XXXXXX")
trap 'rm -f "${TEST_BINARY}"' EXIT

c++ -std=c++17 -Wall -Wextra -Werror \
  -I"${FIRMWARE_ROOT}/include" \
  "${FIRMWARE_ROOT}/test/native/test_firmware.cpp" \
  -o "${TEST_BINARY}"
"${TEST_BINARY}"

if ! command -v pio >/dev/null 2>&1; then
  echo "PlatformIO (pio) is required for the ESP32 compile gate." >&2
  exit 1
fi

pio run --project-dir "${FIRMWARE_ROOT}" \
  --environment esp32dev \
  --environment esp32dev_four_channel
