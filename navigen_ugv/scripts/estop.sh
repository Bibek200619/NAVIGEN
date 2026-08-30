#!/usr/bin/env bash
set -euo pipefail

usage() {
  echo "Usage: $0 engage | release --confirm" >&2
  exit 2
}

action="${1:-}"
case "$action" in
  engage)
    state=true
    ;;
  release)
    [[ "${2:-}" == "--confirm" ]] || usage
    state=false
    ;;
  *)
    usage
    ;;
esac

exec ros2 topic pub --once /safety/e_stop std_msgs/msg/Bool "{data: ${state}}"
