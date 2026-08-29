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
| 2 | Gazebo Harmonic simulation and teleoperation | IN PROGRESS | 15% | Gazebo plugin xacro and `teleop.sh` exist. World, bringup launch/config, topic bridges, and simulation smoke tests are missing. |
| 3 | Nav2 point-to-point simulation | NOT STARTED | 0% | Planner/controller/costmap configuration and navigation acceptance test are missing. |
| 4 | ESP32 firmware and Raspberry Pi serial bridge | NOT STARTED | 0% | A pre-existing unmerged bridge draft is present at commit `69c3a69`; it must be reviewed and gated during Phase 4. Firmware is still a template. |
| 5 | Real UGV teleoperation | NOT STARTED | 0% | Requires confirmed wiring, flashed firmware, serial link, lifted-wheel test, and e-stop validation. |
| 6 | Wheel odometry, IMU, EKF | NOT STARTED | 0% | Drivers, calibration, EKF configuration, and fused odometry tests are missing. |
| 7 | Camera and traversability perception | NOT STARTED | 0% | Camera driver, backend abstraction, mock/ONNX inference, messages, and performance tests are missing. |
| 8 | Visual SLAM / visual-inertial odometry | NOT STARTED | 0% | ORB-SLAM3 adapter, tracking-state handling, calibration, and stop-on-loss integration are missing. |
| 9 | Traversability to Nav2 costmap | NOT STARTED | 0% | Occupancy/cost conversion, unknown-cost policy, layer integration, and tests are missing. |
| 10 | Collision avoidance and safety supervisor | NOT STARTED | 0% | Safety arbitration, stale-data checks, ultrasonic filtering, Collision Monitor, and fault tests are missing. |
| 11 | Full outdoor A-to-B autonomous demo | NOT STARTED | 0% | Requires all earlier phase gates plus the physical acceptance run and recorded evidence. |

**Overall completion: 10%.**

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

### Phase 2 acceptance checklist — current gate

- [ ] `navigen_bringup` installs `sim.launch.py`, bridge configuration, and simulation assets.
- [ ] Gazebo Harmonic loads a simple outdoor world with ground, rocks/boxes/trees, and visual terrain variation.
- [ ] The 4WD robot spawns from the same xacro used outside simulation.
- [ ] `/clock`, `/cmd_vel`, `/wheel/odom`, odom TF, `/joint_states`, camera, camera info, and IMU are bridged with correct directions and QoS.
- [ ] Headless launch proves the robot remains spawned and required ROS topics become live.
- [ ] A bounded `/cmd_vel` command moves the robot and changes wheel odometry.
- [ ] Camera and IMU messages carry the configured sensor frames.
- [ ] Launch supports configurable world, spawn pose, RViz, GUI/headless, and simulation time.
- [ ] Simulation smoke tests are deterministic and leave no orphan processes.
- [ ] README/testing/troubleshooting commands match the tested behavior.
- [ ] Full workspace build/tests and Phase 2 integration tests are green.
- [ ] Phase 2 checkpoint is committed locally.

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

## Test and validation ledger

| Gate | Command / method | Status | Notes |
|---|---|---:|---|
| Repository graph integrity | Graphify artifact validation | GREEN | Required files present; graph contains 25 nodes. |
| Phase 1 exact team command | `./scripts/validate_in_docker.sh` | GREEN | Eight packages built; 4 tests, 0 errors, 0 failures, 0 skipped. |
| Phase 1 dependency resolution | `rosdep check --from-paths ... --ignore-src` | GREEN | All system dependencies satisfied. |
| Phase 1 URDF semantics | xacro real/sim + `check_urdf` | GREEN | Both descriptions parsed; root and full static link tree verified. |
| Phase 1 launch API | `ros2 launch navigen_description description.launch.py --show-args` | GREEN | Four configurable launch arguments load correctly. |
| Phase 2 headless launch | Gazebo Harmonic server + topic/TF checks | PENDING | Must verify motion, odometry, IMU, camera, and joint states. |

## Commit ledger

| Commit | Scope | Gate result |
|---|---|---|
| `420609f` | Starting repository baseline | Audit only; Phase 1/2 not green. |
| `787917e` | Phase 1 package structure, lowercase path normalization, URDF/TF/config, tests, and validator | GREEN. |

## What is done now

- Phase 1 is complete and locally committed.
- Eight ROS packages provide explicit ownership boundaries for later work.
- The four-wheel description and all static sensor transforms are configurable and tested.
- The exact Linux/ROS 2 Jazzy validation command is reproducible through Docker.
- Baseline state and unrelated user IDE edits remain preserved and excluded.

## What is missing now

- All substantive Phase 2 bringup/world/bridge/smoke-test work.
- Phases 3 through 11.

## Next action

Complete Phase 2: create the outdoor Gazebo world, simulation launch and bridge configuration, add deterministic headless spawn/sensor/motion tests, repair until every simulation check is green, update this file, and create the Phase 2 local checkpoint commit.
