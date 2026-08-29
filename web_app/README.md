# NAVIGEN Web App

Operator dashboard for the UGV (not part of the autonomy loop).

Planned structure:

```
web_app/
├── frontend/         # Dashboard UI: live camera, map, trajectory, safety state
├── backend/          # API server, session/auth, telemetry storage
├── dashboard/        # Dashboard widgets/views
├── telemetry/        # Telemetry ingestion (WebSocket from the UGV rosbridge)
└── ugv_integration/  # ROS bridge client: /motor/telemetry, /safety/state, /odometry/filtered, goal dispatch
```

Integration contract: the UGV exposes read-only telemetry topics and accepts goals ONLY as
`geometry_msgs/PoseStamped` on `/goal_pose`. The web app can request a software e-stop by
publishing `std_msgs/Bool` on `/safety/e_stop` (latched OFF requires operator action on the UGV).
