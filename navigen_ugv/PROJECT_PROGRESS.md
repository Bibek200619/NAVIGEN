# NAVIGEN UGV Project Progress

This is the human-facing engineering log for the UGV programming team. It records completed work, evidence, missing work, and the next gate. It is not an instruction file for coding agents.

- Last updated: **2026-08-31 (Asia/Kolkata)**
- Working branch: **`feature/ugv-phases-1-11`**
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
| 4 | ESP32 firmware and Raspberry Pi serial bridge | GREEN | 100% | Versioned CRC serial protocol, configurable bridge/mock transport, odometry/telemetry, four-motor ESP32 control, PID/watchdog/e-stop behavior, firmware builds, and tests are committed in `2da087c`. |
| 5 | Real UGV teleoperation | AWAITING PHYSICAL TEST | 75% | Safe real/mock launch, startup and shutdown interlocks, controller e-stop latching, bounded teleop, odometry, docs, and mock acceptance are committed in `6256b16`. Measured configuration and lifted-wheel hardware evidence are still required. |
| 6 | Wheel odometry, IMU, EKF | NOT STARTED | 0% | Drivers, calibration, EKF configuration, and fused odometry tests are missing. |
| 7 | Camera and traversability perception | NOT STARTED | 0% | Camera driver, backend abstraction, mock/ONNX inference, messages, and performance tests are missing. |
| 8 | Visual SLAM / visual-inertial odometry | NOT STARTED | 0% | ORB-SLAM3 adapter, tracking-state handling, calibration, and stop-on-loss integration are missing. |
| 9 | Traversability to Nav2 costmap | NOT STARTED | 0% | Occupancy/cost conversion, unknown-cost policy, layer integration, and tests are missing. |
| 10 | Collision avoidance and safety supervisor | NOT STARTED | 0% | Safety arbitration, stale-data checks, ultrasonic filtering, Collision Monitor, and fault tests are missing. |
| 11 | Full outdoor A-to-B autonomous demo | NOT STARTED | 0% | Requires all earlier phase gates plus the physical acceptance run and recorded evidence. |

**Overall completion: 43%.**

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

- [x] Audit the existing `69c3a69` hardware draft and integrate only compatible, tested work.
- [x] Define a versioned framed serial protocol with sequence number, CRC, bounded payloads, and invalid-packet rejection.
- [x] Implement configurable differential-drive Twist-to-wheel conversion with velocity and acceleration limiting.
- [x] Implement the Raspberry Pi ROS serial bridge with reconnect handling, command cadence, telemetry, diagnostics, and mock mode.
- [x] Implement ESP32 quadrature encoder sampling and left/right 100 Hz PID speed loops.
- [x] Keep every motor, encoder, ultrasonic, e-stop, serial, geometry, PID, PWM, and watchdog setting configurable and unarmed by default.
- [x] Enforce approximately 300 ms firmware communication watchdog and immediate physical/software e-stop motor disable.
- [x] Publish wheel odometry inputs, ultrasonic ranges, telemetry, battery/status, and communication health over standard/custom ROS interfaces as appropriate.
- [x] Unit-test kinematics, encoder conversion, PID, parser/CRC rejection, watchdog, e-stop, reconnect, and mock hardware behavior.
- [x] Compile firmware and build/test the complete ROS workspace without physical hardware.
- [x] Document wiring placeholders, configuration, flashing, mock launch, serial diagnostics, and bench-test safety procedure.
- [x] Commit the Phase 4 implementation locally (`2da087c`); do not push.

### Phase 5 acceptance checklist — SOFTWARE GREEN / PHYSICAL TEST PENDING

- [x] Add a real-hardware bringup composition that uses the shared robot description and ESP32 bridge without Gazebo.
- [x] Provide a bounded keyboard teleoperation path to `/cmd_vel` with the 0.4 m/s demo limit.
- [x] Implement and mock-test physical/software e-stop override, startup inhibition, shutdown assertion, and controller-event latching.
- [x] Validate the real launch contract and all required parameters without connected hardware.
- [x] Run a mock end-to-end real-mode test from `/cmd_vel` through serial protocol telemetry and wheel odometry.
- [x] Document Raspberry Pi serial permissions, device discovery, first power-on, lifted-wheel, direction, and e-stop checks.
- [ ] Fill measured pins, encoder counts, geometry, PID, and limits before arming firmware; do not invent hardware values.
- [ ] Flash the configured ESP32 and verify both motor sides, encoder signs, watchdog, e-stop, and bounded teleoperation on the physical UGV.
- [x] Build/test the complete workspace and commit the Phase 5 software checkpoint locally (`6256b16`); no push.

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

## Test and validation ledger

| Gate | Command / method | Status | Notes |
|---|---|---:|---|
| Repository graph integrity | Graphify artifact validation | GREEN | Required files present; graph contains 25 nodes. |
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
| Phase 4 protocol/bridge unit tests | `colcon test --packages-select navigen_hardware` | GREEN | 19 tests cover kinematics, acceleration limits, framing/CRC rejection, sequence rollover, reconnect/partial writes, mock watchdog/e-stop, ROS topics, odometry, stale/invalid commands, and diagnostics. |
| Phase 4 native firmware tests | `./scripts/validate_firmware.sh` native target | GREEN | Golden protocol vector, parser recovery, telemetry layout, PID, watchdog/millis rollover, encoder velocity/tick rollover, and sequence ordering pass under `-Werror`. |
| Phase 4 ESP32 firmware build | `./scripts/validate_firmware.sh` PlatformIO target | GREEN | Pinned ESP32 platform builds for `esp32dev`; RAM 6.7%, flash 20.9%. Hardware remains deliberately unarmed until measured values are supplied. |
| Phase 4 dependency/API checks | rosdep + bridge launch `--show-args` | GREEN | All system dependencies are satisfied; parameter file, mock mode, serial device, and baud arguments load from the installed package. |
| Phase 4 exact team command | `./scripts/validate_in_docker.sh` | GREEN | Eight packages built; 35 tests, 0 errors, 0 failures, 0 skipped, including Phase 2/3 live Gazebo and Phase 4 bridge gates. |
| Phase 5 real-launch API/dependencies | rosdep + installed `real.launch.py --show-args` | GREEN | All dependencies are satisfied; hardware params, mock mode, startup interlock, serial, baud, joint-state GUI, and RViz controls load. |
| Phase 5 focused software gate | Hardware + bringup package tests | GREEN | 29 tests pass, including controller e-stop latching and live no-Gazebo startup/release/motion/odometry/stop behavior. |
| Phase 5 full regression | Clean cached Jazzy image, all packages | GREEN | Eight packages build; 39 tests, 0 errors, 0 failures, 0 skipped. Earlier live Gazebo and Nav2 gates remain green. |
| Phase 5 physical lifted-wheel gate | Procedure in `docs/hardware.md` | NOT RUN | Requires the configured, wired UGV, motor stands, two operators, and recorded motor/encoder/watchdog/e-stop observations. |

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

## What is done now

- Phases 1 through 4 are complete and locally committed.
- The exact same xacro and `/cmd_vel`/sensor interfaces now run in Gazebo Harmonic.
- Outdoor simulation, camera, camera info, IMU, joint states, wheel odometry, and TF are live and tested.
- Both manual and automated bounded-motion checks prove teleoperation drives the 4WD model.
- Nav2 now plans with SmacPlanner2D, controls with Regulated Pure Pursuit, avoids known mapped
  obstacles, reaches a 7 m goal, and stops in a deterministic headless acceptance test.
- The Raspberry Pi side converts bounded Twist commands into side-wheel targets, maintains a
  reconnecting CRC-protected serial session, and publishes telemetry, wheel odometry, battery,
  range, and diagnostics; the same path runs against deterministic mock hardware.
- The separately built ESP32 firmware runs four motor outputs as two independent PID-controlled
  sides, reads encoders and backup sensors, and disables propulsion on watchdog or e-stop.
- Phase 5 now has one `real.launch.py` contract for protocol-backed mock or physical serial mode,
  deliberate e-stop controls, startup/shutdown inhibition, and controller-stop latching.
- The complete no-hardware teleoperation path is tested from `/cmd_vel` through wheel setpoints,
  mock firmware telemetry, encoder ticks, and `/wheel/odom`.
- The exact Linux/ROS 2 Jazzy validation command is reproducible through Docker.
- Baseline state and unrelated user IDE edits remain preserved and excluded.

## What is missing now

- The physical portion of Phase 5 and all of Phases 6 through 11.
- Phase 5 needs measured hardware values entered in firmware/ROS configuration, a flashed and wired
  ESP32, and recorded lifted-wheel motor direction, encoder sign, watchdog, physical/software
  e-stop, reconnect, and bounded teleoperation results.
- Mock results cannot certify electrical wiring or physical stopping behavior. Phase 6 must not
  begin until those observations are green.

## Next action

On the physical UGV, fill the measured values listed in `docs/hardware.md`, flash the validated
firmware, and execute the two-person lifted-wheel sequence. Record each observed result and any
diagnostic output. If every item passes, mark Phase 5 green and begin Phase 6; otherwise repair and
repeat the failed check before advancing.
