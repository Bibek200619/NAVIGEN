# Aggregated state of the safety supervisor.
std_msgs/Header header

uint8 STATE_OK=0
uint8 STATE_WARNING=1
uint8 STATE_EMERGENCY_STOP=2

uint8 state
string[] active_triggers   # e.g. ["estop", "cmd_stale", "ultrasonic_left", "slam_lost"]
string description
