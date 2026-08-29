# NAVIGEN Mobile App

Mobile companion for monitoring the UGV (not part of the autonomy loop).

Planned structure:

```
mobile_app/
├── ui/               # Screens: status, camera, map
├── auth_settings/    # Authentication and app settings
├── telemetry/        # Live telemetry client (WebSocket)
├── notifications/    # Push alerts: e-stop, SLAM lost, low battery, goal reached
└── ugv_integration/  # Same read-only contract as web_app/ugv_integration
```

Safety rule: mobile/web can trigger a software e-stop, but can never release the physical
e-stop or bypass the safety supervisor.
