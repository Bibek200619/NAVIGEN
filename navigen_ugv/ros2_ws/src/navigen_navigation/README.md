# navigen_navigation

Owns Nav2 planner/controller configuration and the traversability-to-costmap boundary.

## Phase 3 simulation

The current stack uses:

- `nav2_smac_planner::SmacPlanner2D`
- `nav2_regulated_pure_pursuit_controller::RegulatedPurePursuitController`
- static and inflation costmap layers over the known Gazebo world map
- `/wheel/odom` as the odometry input and `/cmd_vel` as the simulation output
- a conservative 0.30 m/s requested speed under the vehicle-wide 0.40 m/s cap

Launch the complete demonstration:

```bash
ros2 launch navigen_navigation nav2_sim.launch.py
```

When Nav2 is active, choose **Nav2 Goal** in RViz and click a target in the map, or run:

```bash
ros2 action send_goal /navigate_to_pose nav2_msgs/action/NavigateToPose \
  "{pose: {header: {frame_id: map}, pose: {position: {x: 7.0, y: 0.0}, orientation: {w: 1.0}}}}"
```

`navigation.launch.py` can launch the Nav2 stack separately. Its default identity
`map → odom` transform is a **simulation-only bootstrap** because Phase 3 does not yet have the
Phase 8 visual localization adapter. Set `publish_map_to_odom:=false` whenever another
localization component owns that transform. It is never a GPS substitute.

The known static map is only the Phase 3 point-to-point baseline. Phase 9 adds the live
vision-derived traversability cost layer without changing the planner/controller interface;
Phase 10 inserts safety command arbitration and Collision Monitor.
