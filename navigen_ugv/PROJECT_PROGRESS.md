# NAVIGEN UGV Project Progress

This is the human-facing engineering log for the UGV programming team. It records completed work, evidence, missing work, and the next gate. It is not an instruction file for coding agents.

- Last updated: **2026-09-05 (Asia/Kolkata)**
- Working branch: **`feature/ugv-l298n-hardware-adapter`**
- Baseline commit: **`420609f`**
- Navigation invariant: **No GPS dependency. Camera/vision remains the primary navigation sensor.**

## How progress is measured

A phase is `GREEN` only when its acceptance checklist is complete, the ROS workspace builds, relevant tests pass, commands are documented, and the phase has a local commit. A phase cannot advance while its gate is red. Percentages are engineering completion estimates, not schedule estimates; the overall value is the average of the eleven phase estimates.

## Phase dashboard

| Phase | Scope | Status | Completion | Current evidence / missing work |
|---|---|---:|---:|---|
| 1 | Repository, ROS packages, URDF, TF, configuration | GREEN | 100% | Eight packages build; real/sim xacro and URDF/TF tests pass; manifests, configurable transforms, docs, and validation tooling are committed in `787917e`. |
| 2 | Gazebo Harmonic simulation and teleoperation | GREEN | 100% | Self-contained outdoor world, installed launch/bridge/config, live camera/IMU/TF/odometry, bounded motion, and deterministic headless integration test are committed in `edd8468`. |
| 3 | Nav2 point-to-point simulation | GREEN | 100% | Known-map Nav2 stack, SmacPlanner2D, Regulated Pure Pursuit, RViz, lifecycle checks, and a collision-free 7 m live acceptance run are committed in `66b500a` and `7b59fd3`. |
| 4 | NodeMCU ESP8266 firmware and Raspberry Pi serial bridge | GREEN | 100% | The available controller is now the pinned `nodemcuv2` target. Protocol v2, bounded open-loop side PWM, watchdog/e-stop, one ultrasonic, honest no-feedback telemetry, generic bridge/mock transport, tests, and documentation are committed in `73fd4d9`. |
| 5 | Real UGV teleoperation | BLOCKED — POWER GATE | 80% | Encoderless real/mock software and the replacement ESP8266 are green. The exact chassis listing confirms 3-6 V motors, but the photographed three-cell 18650 holder cannot feed them directly and stall current, buck capacity, cell protection/BMS, and measured output remain unknown. Firmware stays safety-locked; no powered test is approved. |
| 6 | MPU6050 and visual-odom-ready EKF (no wheel odometry) | NOT STARTED | 0% | The MPU6050 is present, but its Pi I2C driver, rigid mounting, calibration, VIO-oriented EKF configuration, and fused-input tests are missing. |
| 7 | Camera and traversability perception | NOT STARTED | 0% | Camera driver, backend abstraction, mock/ONNX inference, messages, and performance tests are missing. |
| 8 | Visual SLAM / visual-inertial odometry | NOT STARTED | 0% | ORB-SLAM3 adapter, tracking-state handling, calibration, and stop-on-loss integration are missing. |
| 9 | Traversability to Nav2 costmap | NOT STARTED | 0% | Occupancy/cost conversion, unknown-cost policy, layer integration, and tests are missing. |
| 10 | Collision avoidance and safety supervisor | NOT STARTED | 0% | Safety arbitration, stale-data checks, ultrasonic filtering, Collision Monitor, and fault tests are missing. |
| 11 | Full outdoor A-to-B autonomous demo | NOT STARTED | 0% | Requires all earlier phase gates plus the physical acceptance run and recorded evidence. |

**Overall completion: 44%.**

## Current gate

### Phase 1 acceptance checklist — GREEN

- [x] Monorepo contains the UGV project, docs, firmware, simulation, models, config, scripts, and tests areas.
- [x] All eight required ROS 2 packages exist with valid package conventions.
- [x] Four-wheel skid-steer URDF/xacro exists.
- [x] Static base, wheel, camera, IMU, and ultrasonic frames are modeled.
- [x] URDF expands and validates in both real and simulation modes under ROS 2 Jazzy.
- [x] Package manifests declare all runtime/test dependencies.
- [x] Geometry and transform parameters are clearly identified as simulation defaults or hardware measurements.
- [x] `colcon build` and Phase 1 tests are green in Ubuntu 24.04 / ROS 2 Jazzy.
- [x] Setup/build/test commands and actual phase status are accurate in documentation.
- [x] Phase 1 checkpoint is committed locally (`787917e`).

### Phase 2 acceptance checklist — GREEN

- [x] `navigen_bringup` installs `sim.launch.py`, bridge configuration, and simulation assets.
- [x] Gazebo Harmonic loads a simple outdoor world with ground, rocks/boxes/trees, and visual terrain variation.
- [x] The 4WD robot spawns from the same xacro used outside simulation.
- [x] `/clock`, `/cmd_vel`, `/wheel/odom`, odom TF, `/joint_states`, camera, camera info, and IMU are bridged with correct directions and QoS.
- [x] Headless launch proves the robot remains spawned and required ROS topics become live.
- [x] A bounded `/cmd_vel` command moves the robot and changes wheel odometry.
- [x] Camera and IMU messages carry the configured sensor frames.
- [x] Launch supports configurable world, spawn pose, RViz, GUI/headless, and simulation time.
- [x] Simulation smoke tests are deterministic and leave no orphan processes.
- [x] README/testing/troubleshooting commands match the tested behavior.
- [x] Full workspace build/tests and Phase 2 integration tests are green.
- [x] Phase 2 checkpoint is committed locally (`edd8468`).

### Phase 3 acceptance checklist — GREEN

- [x] `navigen_navigation` installs a simulation map, Nav2 parameters, behavior tree, and launch assets.
- [x] A documented simulation-only `map → odom` bootstrap replaces unavailable Phase 8 visual localization without using GPS.
- [x] Nav2 lifecycle nodes reach active state reliably after Gazebo startup.
- [x] Planner is `SmacPlanner2D`; controller is `RegulatedPurePursuitController`.
- [x] Nav2 consumes `/wheel/odom`, emits `/cmd_vel`, and respects the 0.4 m/s demo limit.
- [x] Global/local costmaps represent known Phase 3 world obstacles using static/inflation layers; no fake vision input is introduced.
- [x] A `NavigateToPose` goal in `map` produces a path around a mapped obstacle.
- [x] The simulated UGV reaches the selected point and stops within configured tolerances.
- [x] RViz displays the map, costmaps, path, robot pose, trajectory, and goal.
- [x] Static configuration tests and a deterministic headless point-to-point integration test pass.
- [x] README/testing/troubleshooting commands match tested behavior.
- [x] Full workspace build/tests are green and Phase 3 is committed locally (`7b59fd3`).

### Phase 4 acceptance checklist — GREEN

- [x] Retain a versioned, sequenced, bounded CRC-8 serial protocol and bump it to version 2 so incompatible old firmware is rejected.
- [x] Convert finite `Twist` commands to bounded left/right wheel-surface targets with velocity and acceleration limits.
- [x] Implement reconnecting Pi serial transport, diagnostics, explicit startup e-stop, controller-contract validation, and protocol-level mock mode.
- [x] Target the photographed NodeMCU 1.0 with pinned PlatformIO board `nodemcuv2` and one L298N side-paired motor layout.
- [x] Implement configurable open-loop PWM, direction inversion, side trim, one centered HC-SR04, active-low motor-power feedback, software e-stop, and 300 ms watchdog.
- [x] Keep the physical firmware deliberately unarmed until `HARDWARE_CONFIGURATION_CONFIRMED=1` is set after wiring/electrical review.
- [x] Report `open_loop_mode=true`, `wheel_feedback_valid=false`, zero measured velocities/ticks, and never publish fabricated real/mock `/wheel/odom`.
- [x] Reject NaN/Inf, stale commands, bad CRC/version/length/payload, unexpected controller mode, stale telemetry, and unsafe e-stop release.
- [x] Unit/integration-test kinematics, PWM mapping, protocol, watchdog, e-stop/latching, reconnect, startup safety, no-odometry contract, and mock behavior.
- [x] Pass native C++ tests, pinned NodeMCU compilation, all eight ROS package builds, and the full 37-test Jazzy/Gazebo/Nav2 regression.
- [x] Document exact NodeMCU labels, L298N jumper contract, pin limits, fixed camera, absent encoders, power/divider unknowns, flashing, and lifted-wheel procedure.
- [x] Commit the current Phase 4 hardware implementation locally (`73fd4d9`); do not push.

### Phase 5 acceptance checklist — SOFTWARE GREEN / POWER GATE RED

- [x] Compose the shared non-Gazebo description and generic motor-controller bridge in `real.launch.py`.
- [x] Provide bounded keyboard teleoperation with encoderless defaults of 0.15 m/s linear and 0.50 rad/s angular.
- [x] Mock-test startup inhibition, explicit release only after valid telemetry, stale/invalid stop, controller e-stop latching, shutdown assertion, and watchdog behavior.
- [x] Validate the real launch without hardware from `/cmd_vel` through protocol v2 to PWM telemetry while asserting that `/wheel/odom` is absent.
- [x] Adapt firmware and all hardware-facing docs from ESP32/encoder PID to the available NodeMCU ESP8266/open-loop profile (`73fd4d9`).
- [x] Document Pi serial permissions/device discovery and the two-person physical gate.
- [x] Flash a replacement ESP8266 with `HARDWARE_CONFIGURATION_CONFIRMED=0`, verify the complete image digest, and observe live protocol-v2 telemetry at 115200 baud.
- [x] Reconnect the reviewed D1/D2/D5/D6/common-ground signal harness with motor power absent and confirm that the controller still boots and streams zero-output telemetry.
- [x] Identify the exact chassis listing and record its seller specifications: 3-6 V, 200 RPM,
      1:48 BO motors; 208 RPM no-load at 5 V; 170 mA load current at 4.5 V; stall current omitted.
- [ ] Provide a measured, current-rated 5-6 V motor rail; identify cell/3S protection and charger;
      record side-pair stall current, L298N thermal margin, switch rating, buck capacity, and
      wheel/track geometry. Direct three-cell-holder input is forbidden.
- [ ] Wire and meter-check IN1–IN4, common grounds, HC-SR04 ECHO divider, and active-low D0 motor-power feedback. Keep camera fixed and SG90s disconnected.
- [ ] Set `HARDWARE_CONFIGURATION_CONFIRMED=1`, rebuild, flash `nodemcuv2`, and verify valid open-loop telemetry while motor power is off.
- [ ] Complete and record forward/reverse/turn direction, PWM trim, software stop, independent physical power cut/latch, 300 ms USB-loss stop, reconnect, and conservative lifted-wheel teleoperation.
- [x] Build/test and locally commit the encoderless software checkpoint; no push.

## Activity log

| ID | Date | Activity | Result / evidence |
|---|---|---|---|
| A001 | 2026-08-29 | Established protected working branch and no-push rule. | Work continues on `feature/ugv-phases-1-11`; no remote mutation authorized. |
| A002 | 2026-08-29 | Audited Git history and current worktree. | Baseline is `420609f`. Existing `.idea/misc.xml` and `.idea/workspace.xml` edits belong to the user and are excluded from project commits. |
| A003 | 2026-08-29 | Built a local architecture map of the repository. | 24 supported files produced a validated 25-node / 19-edge graph in ignored local `graphify-out/`. |
| A004 | 2026-08-29 | Audited Phase 1 and Phase 2 against requested deliverables. | Phase 1 is partial; Phase 2 is not complete. README claims were found to be ahead of committed code. |
| A005 | 2026-08-29 | Checked validation environment. | Host is macOS ARM64 without ROS; Linux ARM64 Docker is available for ROS 2 Jazzy/Gazebo Harmonic gates. |
| A006 | 2026-08-29 | Normalized the UGV directory name. | Git now tracks only lowercase `navigen_ugv`; this prevents case-sensitive Linux clone failures. |
| A007 | 2026-08-29 | Completed Phase 1 package and description foundation. | Added all six missing package boundaries, configurable six-DoF sensor transforms, launch arguments, URDF/TF tests, worlds area, and Jazzy/Harmonic validator. |
| A008 | 2026-08-29 | Closed validation defects through micro-loops. | Fixed ROS setup sourcing under shell nounset and removed invalid `ament_python` rosdep keys; each fix was retested. |
| A009 | 2026-08-29 | Passed and committed the Phase 1 gate. | Eight packages build; 4 tests report 0 errors/failures; rosdep, real/sim `check_urdf`, and launch argument checks pass. Commit `787917e`. |
| A010 | 2026-08-29 | Repaired a TF ownership defect found during Phase 2 wiring. | `base_link` is now the massless moving root, with `base_footprint` and inertial `base_chassis_link` as children; `odom → base_link` has one parent and KDL starts without its root-inertia warning. |
| A011 | 2026-08-29 | Implemented the complete Gazebo Harmonic simulation path. | Added configurable motion/sensor tuning, a self-contained outdoor world, shared-xacro spawning, directional bridge YAML, GUI/headless/RViz launch options, and package installation/dependencies. |
| A012 | 2026-08-29 | Ran the manual live Phase 2 acceptance probe. | Camera is 320×240 in `camera_optical_frame`; IMU is `imu_link`; odometry is `odom → base_link`; all required topics are live; a 0.2 m/s command changed x from 0.00 m to 0.74 m. |
| A013 | 2026-08-29 | Closed two integration-test defects through micro-loops. | Replaced an unavailable Jazzy clock QoS alias, then corrected command duration to use wall-clock 10 Hz publication; the focused live test passed after each repair. |
| A014 | 2026-08-29 | Passed the full Phase 2 release gate. | Eight packages build; 10 tests report 0 errors/failures/skips; rosdep, simulation `check_urdf`, launch API, live sensors, TF, and motion all pass. |
| A015 | 2026-08-29 | Committed the Phase 2 implementation locally. | Commit `edd8468`; no push was performed. |
| A016 | 2026-08-30 | Implemented the Phase 3 known-map Nav2 baseline. | Added a Gazebo-aligned occupancy map, minimal lifecycle Nav2 composition, SmacPlanner2D, Regulated Pure Pursuit, recovery BT, RViz displays, and static/live acceptance tests in `66b500a`. |
| A017 | 2026-08-30 | Closed initial Phase 3 launch-test defects through micro-loops. | Fixed a `Path` import collision, Jazzy integer costmap dimensions, and `/clock` sensor QoS; the focused autonomous test then passed. |
| A018 | 2026-08-30 | Exercised Phase 3 after the Phase 2 test under full-suite load. | The first full run exposed a brittle 20 ms BT action acknowledgment timeout; raised it to a bounded 1000 ms and added a regression assertion. |
| A019 | 2026-08-30 | Passed the complete Phase 3 release gate. | Eight packages build; 16 tests report 0 errors/failures/skips. The UGV plans around the central obstacle, travels to x=7 m, respects command bounds, reaches tolerance, and stops. |
| A020 | 2026-08-30 | Hardened reproducibility and committed the Phase 3 gate locally. | Validator now copies only source into a fresh temporary workspace; Gazebo tests use isolated partitions; operator docs and troubleshooting are current. Commit `7b59fd3`; no push was performed by this work. |
| A021 | 2026-08-30 | Audited the prior Phase 4 draft and defined one shared wire contract. | Python and C++ now use the same bounded, versioned, sequenced CRC-8/ATM frame format; a checked golden packet prevents protocol drift. |
| A022 | 2026-08-30 | Implemented the Raspberry Pi hardware layer. | Added differential-drive conversion, acceleration limiting, reconnecting serial transport, protocol-backed mock ESP32, wheel odometry, telemetry, battery/range topics, diagnostics, and launch/config assets. |
| A023 | 2026-08-30 | Implemented the ESP32 controller. | Four motor channels feed independent 100 Hz side PID loops; quadrature encoders, nonblocking ultrasonics, physical/software e-stop, 300 ms watchdog, battery status, and 30 Hz telemetry are implemented with an unarmed board configuration. |
| A024 | 2026-08-30 | Closed Phase 4 defects through focused micro-loops. | Corrected sensor QoS, native C++ warnings, isolated PlatformIO cache permissions, fresh diagnostic sampling, command-sequence recovery after endpoint reboot, and the clean-image `python3-serial` dependency; every fix was retested. |
| A025 | 2026-08-30 | Passed the complete Phase 4 release gate. | Native firmware tests and ESP32 compilation pass; the clean ROS image satisfies rosdep and launch checks; eight packages build and 35 tests report 0 errors/failures/skips. |
| A026 | 2026-08-30 | Committed the Phase 4 implementation locally. | Commit `2da087c`; no push was performed. |
| A027 | 2026-08-31 | Added the Phase 5 physical/mock bringup composition. | `real.launch.py` composes the shared non-Gazebo description and ESP32 bridge with configurable serial settings, optional RViz, and software e-stop asserted by default. |
| A028 | 2026-08-31 | Hardened manual-control safety. | Added deliberate e-stop engage/release tooling, zero-plus-e-stop shutdown, and a Pi-side latch for controller-reported physical e-stop events so switch release cannot resume stale motion. |
| A029 | 2026-08-31 | Added no-hardware Phase 5 acceptance coverage. | Installed-package checks and a live launch test prove static TF/joints, startup inhibition, explicit release, bounded Twist-to-protocol motion, encoder odometry, and immediate e-stop override. |
| A030 | 2026-08-31 | Closed the Phase 5 validation micro-loop. | Docker registry metadata timed out before compilation; rerunning entirely from the cached Jazzy image removed the network dependency. Focused 29-test and final 39-test runs passed. |
| A031 | 2026-08-31 | Documented and committed the Phase 5 software checkpoint. | Wiring/calibration placeholders and a two-person lifted-wheel procedure are documented. Commit `6256b16`; no push was performed. |
| A032 | 2026-08-31 | Held the sequential gate at physical Phase 5 acceptance. | Software is green, but no physical UGV is attached to this workspace. Per the project rule, Phase 6 has not started and Phase 5 is not mislabeled green. |
| A033 | 2026-09-04 | Audited the team's initially reported physical hardware against the Phase 5-8 contracts. | One L298N requires two side-paired outputs; wheel encoders and the mandatory hardwired e-stop were unconfirmed, the MPU6050 was absent from the initial list, and SG90 pan/tilt motion is incompatible with the current static SLAM camera transform. |
| A034 | 2026-09-04 | Added the single-L298N motor adapter and hardware guidance. | The default firmware now drives ENA/IN1/IN2 as LEFT and ENB/IN3/IN4 as RIGHT, retains a compile-tested four-channel option, and documents power, current, camera-mount, encoder, e-stop, and level-shifting constraints. |
| A035 | 2026-09-04 | Closed the L298N software validation loop and committed it. | Native firmware tests and both PlatformIO layouts pass; an offline cached Jazzy image built eight ROS packages and passed all 39 tests. Commit `dc79e38`; no push was performed. |
| A036 | 2026-09-04 | Audited nine supplied hardware photographs and corrected the hardware record. | Photos confirm the L298N, MPU6050, HC-SR04, SG90, relay, three-cell holder, and encoderless-looking TT motors. The photographed controller is an incompatible NodeMCU ESP8266, no quadrature encoders are fitted, the relay is not an independent physical e-stop, and battery topology/rating remains unverified. Compatibility guidance is committed in `0bc357f`. |
| A037 | 2026-09-04 | Replanned around the user's final constraint: only the ESP8266 and no encoders are available. | Chose an explicit encoderless open-loop profile; real localization moves to fixed-camera + MPU6050 VIO, and fake wheel odometry/PID claims are forbidden. |
| A038 | 2026-09-04 | Replaced the ESP32 implementation with the actual NodeMCU/L298N profile. | Added pinned `nodemcuv2` firmware, four-input PWM, side trim, one centered ultrasonic, active-low stop feedback, watchdog, protocol v2, generic bridge names, and conservative ROS parameters. |
| A039 | 2026-09-04 | Made the no-feedback contract executable and documented. | Real/mock telemetry explicitly marks open-loop mode, velocity/ticks remain zero, `/wheel/odom` is absent, dead encoder/PID helpers were removed, and camera/IMU autonomy constraints are documented. |
| A040 | 2026-09-04 | Closed the validation micro-loop. | First full run found one early telemetry sample before startup e-stop transmission (37 tests: one failure). The bridge now sends zero + asserted e-stop synchronously; rerun passed all 37 tests. |
| A041 | 2026-09-04 | Passed and committed the ESP8266 migration gate. | Native tests pass; `nodemcuv2` builds at 34.6% RAM / 25.7% flash; eight ROS packages and all live Gazebo/Nav2/real-mock tests pass. Commit `73fd4d9`; no push performed. |
| A042 | 2026-09-05 | Diagnosed the first physical NodeMCU upload failure without writing its flash. | Its CH340 USB interface enumerated, but both uploader versions, manual boot mode, slow-baud sync, and a 74880-baud reset-log probe received no ESP8266 data. The board was removed from the gate as a likely hardware/reset-path fault. |
| A043 | 2026-09-05 | Flashed and verified the safety-locked firmware on a replacement ESP8266. | The replacement identified as ESP8266EX, PlatformIO upload succeeded, all 272,400 flashed bytes passed digest verification, and repeated protocol-v2 telemetry frames were observed at 115200 baud. Propulsion remains disabled because the confirmation flag is `0`. |
| A044 | 2026-09-05 | Passed the USB-only controller/L298N signal-harness smoke test. | With motor supply absent and D1/D2/D5/D6/common ground attached, the ESP8266 enumerated and continuously emitted zero-output protocol-v2 telemetry. This does not approve battery voltage, motor current, or powered motion. |
| A045 | 2026-09-05 | Audited the exact Blessaro chassis listing supplied by the user. | The seller specifies four 3-6 V, 200 RPM, 1:48 BO motors, 208 RPM no-load at 5 V, 0.8 kg.cm torque at 5 V, and 170 mA load current at 4.5 V, but omits stall current. This resolves the earlier 3 V-only report while confirming that direct use of the three-cell 18650 holder remains unsafe. Phase 5 is blocked at the regulated-power gate; firmware remains unarmed. |

## Test and validation ledger

| Gate | Command / method | Status | Notes |
|---|---|---:|---|
| Repository graph integrity | `graphify update` after migration | GREEN | Current graph rebuilt successfully: 1,487 nodes, 4,030 edges, 133 communities. |
| Phase 1 exact team command | `./scripts/validate_in_docker.sh` | GREEN | Eight packages built; 4 tests, 0 errors, 0 failures, 0 skipped. |
| Phase 1 dependency resolution | `rosdep check --from-paths ... --ignore-src` | GREEN | All system dependencies satisfied. |
| Phase 1 URDF semantics | xacro real/sim + `check_urdf` | GREEN | Both descriptions parsed; root and full static link tree verified. |
| Phase 1 launch API | `ros2 launch navigen_description description.launch.py --show-args` | GREEN | Four configurable launch arguments load correctly. |
| Phase 2 headless launch | Gazebo Harmonic server + topic/TF checks | GREEN | Same xacro spawned; clock, odometry, odom TF, four joint states, 320×240 camera/camera-info and IMU all carried valid data/frames. |
| Phase 2 bounded motion | Automated 0.2 m/s command at 10 Hz | GREEN | Integration test requires >0.15 m motion; manual probe observed x 0.00→0.74 m. |
| Phase 2 exact team command | `./scripts/validate_in_docker.sh` | GREEN | Eight packages built; 10 tests, 0 errors, 0 failures, 0 skipped, including live Gazebo. |
| Phase 2 dependency/API checks | rosdep + sim xacro/check_urdf + launch `--show-args` | GREEN | Dependencies satisfied; root is `base_link`; all configurable launch arguments load. |
| Phase 3 static contracts | Installed-package pytest for map/config/launch/BT/RViz | GREEN | 3 tests verify exact plugins, limits, layers, map/world alignment, launch ownership, behavior tree, and displays. |
| Phase 3 autonomous goal | Headless `NavigateToPose` to `(7.0, 0.0)` | GREEN | Five lifecycle nodes active; path deviates around the mapped obstacle; bounded commands move >5 m; result succeeds inside 0.28 m and ends at zero command. |
| Phase 3 exact team command | `./scripts/validate_in_docker.sh` | GREEN | Eight packages built; 16 tests, 0 errors, 0 failures, 0 skipped, including sequential Phase 2 and Phase 3 Gazebo gates. |
| Phase 3 dependency/API checks | rosdep + both navigation launch files `--show-args` | GREEN | All dependencies satisfied; map/params/time/RViz/spawn/bootstrap arguments load from the installed packages. |
| Phase 4 protocol/bridge unit tests | full clean `colcon test` hardware package | GREEN | 17 tests cover Twist conversion/limits, protocol v2/CRC rejection, sequence rollover, reconnect/partial writes, open-loop mock watchdog/e-stop, startup contract, no fake odometry, stale/invalid commands, and diagnostics. |
| Phase 4 native firmware tests | `./scripts/validate_firmware.sh` native target | GREEN | Protocol golden vector, parser recovery, zero-feedback telemetry layout, open-loop PWM mapping, watchdog/millis rollover, and sequence ordering pass under `-Werror`. |
| Phase 4 NodeMCU firmware build | `./scripts/validate_firmware.sh` PlatformIO target | GREEN | Pinned `platformio/espressif8266@4.2.1` / `nodemcuv2` build succeeds; RAM 34.6%, flash 25.7%. Firmware stays unarmed until physical review. |
| Phase 4 physical NodeMCU flash/liveness | PlatformIO upload + `esptool verify_flash` + 115200-baud telemetry capture | GREEN | Replacement ESP8266EX accepted the safety-locked image; all 272,400 bytes matched and live protocol-v2 frames streamed. No motor command can arm while confirmation remains `0`. |
| Phase 5 USB-only signal harness | Visual pin review + telemetry capture with L298N motor supply absent | GREEN | Controller continues to boot and transmit framed zero-output telemetry with D1/D2/D5/D6/common ground attached; powered wiring remains unapproved. |
| Phase 5 motor/product compatibility | Exact Amazon ASIN `B0GHJCXHWK` listing + L298 data-sheet comparison | RED / BLOCKED | Motors are 3-6 V, not 3 V-only. The listing omits stall current; direct 3S input can reach 12.6 V and is not approved. A measured, current-rated 5-6 V rail and protected battery path are required. |
| Current hardware compatibility | Photo audit + revised executable profile | SOFTWARE GREEN / PHYSICAL GATE | NodeMCU, L298N, MPU6050, HC-SR04, and encoderless motors are now represented honestly. Battery topology/current ratings and safe switch/divider wiring still require measurement. |
| Phase 4 dependency/API checks | rosdep + bridge launch `--show-args` | GREEN | All system dependencies are satisfied; parameter file, mock mode, serial device, and baud arguments load from the installed package. |
| Current exact team command | `./scripts/validate_in_docker.sh` | GREEN | Eight packages built; 37 tests, 0 errors, 0 failures, 0 skipped, including live Gazebo, Nav2, and encoderless real/mock bringup. |
| Phase 5 real-launch API/dependencies | rosdep + installed `real.launch.py --show-args` | GREEN | All dependencies are satisfied; hardware params, mock mode, startup interlock, serial, baud, joint-state GUI, and RViz controls load. |
| Phase 5 focused software gate | Hardware + real-bringup tests within full gate | GREEN | Startup e-stop, release preconditions, bounded PWM, absent wheel feedback/odometry, latching, invalid/stale stop, and live no-Gazebo launch all pass. |
| Phase 5 startup race regression | Initial full run → micro-fix → full rerun | GREEN | First run: 37 tests, one failure from early pre-e-stop telemetry. Synchronous startup zero/e-stop fixed it; rerun: 37/37 pass. |
| Phase 5 physical lifted-wheel gate | Procedure in `docs/hardware.md` | NOT RUN | Safety-locked flashing is proven; the gate still requires measured/reviewed power and divider values, an armed reflash, motor stands, two operators, and recorded direction/PWM/watchdog/e-stop observations. |

## Commit ledger

| Commit | Scope | Gate result |
|---|---|---|
| `420609f` | Starting repository baseline | Audit only; Phase 1/2 not green. |
| `787917e` | Phase 1 package structure, lowercase path normalization, URDF/TF/config, tests, and validator | GREEN. |
| `777d5a8` | Human-facing Phase 1 evidence and next-gate status | GREEN checkpoint recorded. |
| `edd8468` | Phase 2 outdoor world, Gazebo launch/bridge, configurable simulation, TF fix, documentation, and live integration tests | GREEN. |
| `d836649` | Human-facing Phase 2 evidence and next-gate status | GREEN checkpoint recorded. |
| `66b500a` | Phase 3 map, Nav2 configuration/launch, behavior tree, RViz, tests, and Jazzy compatibility fixes | Implementation checkpoint. |
| `7b59fd3` | Phase 3 reliability timeout, clean-room validator, test isolation, and operator documentation | GREEN. |
| `2da087c` | Phase 4 ESP32 firmware, serial protocol/bridge, mock hardware, configuration, tests, and operator documentation | GREEN. |
| `6256b16` | Phase 5 real/mock bringup, startup/shutdown interlocks, controller e-stop latch, live acceptance test, and physical procedure | Software GREEN; physical gate pending. |
| `dc79e38` | Team hardware adaptation: one-L298N two-side output, retained four-channel mode, native/build tests, and operator safety documentation | Software GREEN; physical gate pending. |
| `0bc357f` | Photo-backed controller, encoder, IMU, e-stop, battery, and wiring compatibility guidance | Documentation GREEN; physical gate remains blocked by hardware. |
| `73fd4d9` | Replace obsolete ESP32/encoder profile with tested NodeMCU ESP8266 open-loop firmware, bridge, mock, launch/config, tests, and hardware documentation | Software GREEN; physical gate pending. |

## What is done now

- Phases 1 through 4 are complete and locally committed.
- Gazebo Harmonic simulation and known-map Nav2 remain green: camera/IMU/TF/simulated wheel odom
  are live, SmacPlanner2D routes around the obstacle, Regulated Pure Pursuit reaches the 7 m goal,
  and the robot stops.
- The available NodeMCU ESP8266 is now a first-class pinned firmware target; no ESP32 is required
  for the current chassis.
- One L298N drives both left motors and both right motors using D1/D2/D5/D6 with ENA/ENB jumpers
  installed. Open-loop PWM has configurable inversion, deadband, maximum, and side-reduction trim.
- Protocol v2, CRC/sequence checks, 300 ms firmware watchdog, physical/software e-stop handling,
  one centered HC-SR04, telemetry, and reconnecting Pi transport are implemented and tested.
- The encoderless limitation is represented honestly: measured velocities/ticks are zero,
  telemetry says feedback is invalid, and real/mock hardware does not publish `/wheel/odom`.
- Real bringup starts stopped, refuses release until fresh valid open-loop telemetry exists, sends
  synchronous startup zero/e-stop, rejects invalid/stale commands, and latches controller stops.
- The Raspberry Pi Camera + MPU6050 path is the planned real pose source. SG90s remain disconnected
  and the camera is fixed while localization runs.
- Exact wiring roles, unsafe unknowns, calibration, flashing, troubleshooting, and a two-person
  lifted-wheel checklist match the photographed parts.
- The exact Linux/ROS 2 Jazzy validation command is reproducible through Docker.
- Native firmware tests and the `nodemcuv2` compile are green; all 8 ROS packages and 37 tests are
  green. Baseline state and the user's unrelated IDE edit remain preserved and excluded.
- A replacement physical ESP8266EX now contains the safety-locked firmware. Flash verification and
  live protocol-v2 telemetry are green; the first board remains unsuitable because its USB bridge
  enumerates but the ESP8266 produces no serial/bootloader data.
- The exact Blessaro listing identifies the four chassis motors as 3-6 V, 200 RPM, 1:48 BO units.
  This supersedes the unverified 3 V-only report but does not provide their stall current.

## What is missing now

- The physical portion of Phase 5 and all of Phases 6 through 11.
- Phase 5 needs a measured, current-rated 5-6 V motor supply. The photographed three-cell 18650
  holder must not be connected directly because a 3S lithium-ion stack can reach 12.6 V while the
  verified motors are rated 3-6 V.
- Cell/protection/BMS/charger condition, combined side stall current, L298N thermal margin,
  switch/contact rating, buck output capacity, wheel radius, and effective track width remain
  unknown. The seller's 170 mA load-current figure is not a stall-current rating.
- HC-SR04 ECHO and D0 motor-power feedback need correctly calculated, measured 3.3 V-safe divider
  wiring. The photographed resistor bands are not clear enough to approve values remotely.
- The replacement NodeMCU has been flashed and verified with the firmware intentionally unarmed.
  The team must finish peer review, set `HARDWARE_CONFIGURATION_CONFIRMED=1`, rebuild/reflash, and
  record every lifted-wheel result.
- The physical switch must independently remove L298N motor power and provide reliable active-low
  feedback. If its rating/contact arrangement cannot satisfy both, Phase 5 remains blocked; do not
  substitute a software-controlled relay as the only stop.
- Encoders are **not** required for Phase 5, but open-loop drive cannot estimate distance or hold
  exact heading. Full autonomous ground testing must wait for camera/IMU visual-inertial feedback.
- The MPU6050 is available, but mounting, wiring, calibration, ROS input, and EKF integration are
  still Phase 6 work.
- Mock results cannot certify electrical wiring or physical stopping behavior. Phase 6 must not
  begin until those observations are green.

## Next action

Follow `docs/hardware.md` in order. Keep the cells removed and the arming flag at `0`. First obtain
or borrow a multimeter, identify the buck converter and its continuous/transient current rating,
and establish a protected battery path feeding a measured 5-6 V motor rail. Measure or obtain the
stall current so two motors per L298N channel remain within the driver and switch limits. Record
the L298N 5 V regulator-jumper arrangement, resistor values, wheel diameter, and track width. Only
after a second team member approves that record may the HC-SR04/D0 dividers be meter-checked and
the firmware be armed/reflashed. Then execute the two-person lifted-wheel gate at 0.05 m/s and save
`/motor/telemetry` and `/diagnostics` evidence. Mark Phase 5 green only when every power, direction,
stop, watchdog, reconnect, and temperature check passes; otherwise cut motor power and loop on the
failed item. No encoder or ESP32 purchase is part of this next action.
