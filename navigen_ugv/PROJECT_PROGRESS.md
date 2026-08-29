# NAVIGEN UGV Project Progress

This is the human-facing engineering log for the UGV programming team. It records completed work, evidence, missing work, and the next gate. It is not an instruction file for coding agents.

- Last updated: **2026-08-29 (Asia/Kolkata)**
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
| 3 | Nav2 point-to-point simulation | NOT STARTED | 0% | Planner/controller/costmap configuration and navigation acceptance test are missing. |
| 4 | ESP32 firmware and Raspberry Pi serial bridge | NOT STARTED | 0% | A pre-existing unmerged bridge draft is present at commit `69c3a69`; it must be reviewed and gated during Phase 4. Firmware is still a template. |
| 5 | Real UGV teleoperation | NOT STARTED | 0% | Requires confirmed wiring, flashed firmware, serial link, lifted-wheel test, and e-stop validation. |
| 6 | Wheel odometry, IMU, EKF | NOT STARTED | 0% | Drivers, calibration, EKF configuration, and fused odometry tests are missing. |
| 7 | Camera and traversability perception | NOT STARTED | 0% | Camera driver, backend abstraction, mock/ONNX inference, messages, and performance tests are missing. |
| 8 | Visual SLAM / visual-inertial odometry | NOT STARTED | 0% | ORB-SLAM3 adapter, tracking-state handling, calibration, and stop-on-loss integration are missing. |
| 9 | Traversability to Nav2 costmap | NOT STARTED | 0% | Occupancy/cost conversion, unknown-cost policy, layer integration, and tests are missing. |
| 10 | Collision avoidance and safety supervisor | NOT STARTED | 0% | Safety arbitration, stale-data checks, ultrasonic filtering, Collision Monitor, and fault tests are missing. |
| 11 | Full outdoor A-to-B autonomous demo | NOT STARTED | 0% | Requires all earlier phase gates plus the physical acceptance run and recorded evidence. |

**Overall completion: 18%.**

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

### Phase 3 acceptance checklist — next gate

- [ ] `navigen_navigation` installs a simulation map, Nav2 parameters, behavior tree, and launch assets.
- [ ] A documented simulation-only `map → odom` bootstrap replaces unavailable Phase 8 visual localization without using GPS.
- [ ] Nav2 lifecycle nodes reach active state reliably after Gazebo startup.
- [ ] Planner is `SmacPlanner2D`; controller is `RegulatedPurePursuitController`.
- [ ] Nav2 consumes `/wheel/odom`, emits `/cmd_vel`, and respects the 0.4 m/s demo limit.
- [ ] Global/local costmaps represent known Phase 3 world obstacles using static/inflation layers; no fake vision input is introduced.
- [ ] A `NavigateToPose` goal in `map` produces a path around a mapped obstacle.
- [ ] The simulated UGV reaches the selected point and stops within configured tolerances.
- [ ] RViz displays the map, costmaps, path, robot pose, trajectory, and goal.
- [ ] Static configuration tests and a deterministic headless point-to-point integration test pass.
- [ ] README/testing/troubleshooting commands match tested behavior.
- [ ] Full workspace build/tests are green and Phase 3 is committed locally.

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

## Commit ledger

| Commit | Scope | Gate result |
|---|---|---|
| `420609f` | Starting repository baseline | Audit only; Phase 1/2 not green. |
| `787917e` | Phase 1 package structure, lowercase path normalization, URDF/TF/config, tests, and validator | GREEN. |
| `777d5a8` | Human-facing Phase 1 evidence and next-gate status | GREEN checkpoint recorded. |
| `edd8468` | Phase 2 outdoor world, Gazebo launch/bridge, configurable simulation, TF fix, documentation, and live integration tests | GREEN. |

## What is done now

- Phases 1 and 2 are complete and locally committed.
- The exact same xacro and `/cmd_vel`/sensor interfaces now run in Gazebo Harmonic.
- Outdoor simulation, camera, camera info, IMU, joint states, wheel odometry, and TF are live and tested.
- Both manual and automated bounded-motion checks prove teleoperation drives the 4WD model.
- The exact Linux/ROS 2 Jazzy validation command is reproducible through Docker.
- Baseline state and unrelated user IDE edits remain preserved and excluded.

## What is missing now

- Phases 3 through 11.
- Phase 3 specifically needs a simulation map/bootstrap transform, Nav2 configuration/launch,
  point-to-point goal handling, and an autonomous integration test.

## Next action

Begin Phase 3: configure Nav2 with SmacPlanner2D and Regulated Pure Pursuit, add a simulation-only known map and `map → odom` bootstrap, then prove a headless `NavigateToPose` goal plans around a mapped obstacle and reaches its target without any GPS input.
