# Visual SLAM / visual odometry tracking state (ORB-SLAM3 adapter).
std_msgs/Header header

uint8 INITIALIZING=0
uint8 TRACKING=1
uint8 LOST=2
uint8 RELOCALIZING=3

uint8 state
uint32 tracked_features
