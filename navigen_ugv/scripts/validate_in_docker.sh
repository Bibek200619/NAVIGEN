#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
UGV_ROOT=$(cd -- "${SCRIPT_DIR}/.." && pwd)
REPOSITORY_ROOT=$(cd -- "${UGV_ROOT}/.." && pwd)
IMAGE_NAME=${NAVIGEN_ROS_IMAGE:-navigen-ros-jazzy-harmonic:local}

docker build \
  --file "${UGV_ROOT}/docker/ros-jazzy-harmonic.Dockerfile" \
  --tag "${IMAGE_NAME}" \
  "${REPOSITORY_ROOT}"

docker run --rm \
  --volume "${REPOSITORY_ROOT}:/repository:ro" \
  "${IMAGE_NAME}" \
  bash -lc '
    source /opt/ros/jazzy/setup.bash
    set -eo pipefail
    NAVIGEN_TEST_WS=$(mktemp -d)
    cp -a /repository/navigen_ugv/ros2_ws/src "${NAVIGEN_TEST_WS}/src"
    cd "${NAVIGEN_TEST_WS}"
    colcon build --symlink-install --event-handlers console_direct+
    source install/setup.bash
    set -u
    colcon test --event-handlers console_direct+
    colcon test-result --verbose
  '
