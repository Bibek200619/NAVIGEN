import React, { useState, useMemo } from 'react';
import { MissionStatus } from '../../components/mission/MissionStatus';
import {
  MissionControls,
  type SetGoalCoordinates,
} from '../../components/mission/MissionControls';
import { MissionHistory } from '../../components/mission/MissionHistory';
import { MissionGoals } from '../../components/mission/MissionGoals';
import { useRobotData } from '../../hooks/useRobotData';
import { useMissions } from '../../hooks/useMissions';
import { useMissionDetail } from '../../hooks/useMissionDetail';
import { useRobotCommand } from '../../hooks/useRobotCommand';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useSafetyStatus } from '../../hooks/useSafetyStatus';
import type { Mission } from '../../types/mission';
import type { CommandType } from '../../types/api';

export const MissionPage: React.FC = () => {
  const {
    selectedRobot,
    selectedRobotId,
    isLoading: isRobotLoading,
    error: robotError,
  } = useRobotData();

  const { telemetry } = useTelemetry();
  const { latestEvent: latestSafetyEvent } = useSafetyStatus(selectedRobotId);

  const {
    missions,
    isLoading: isMissionsLoading,
    error: missionsError,
    refetch: refetchMissions,
  } = useMissions(selectedRobotId);

  // Identify active or default mission
  const activeMission = useMemo(() => {
    return (
      missions.find((m) => m.status === 'in_progress') ||
      missions.find((m) => m.status === 'pending') ||
      null
    );
  }, [missions]);

  // Allow user to view a specific mission from history, falling back to active mission
  const [selectedMissionOverride, setSelectedMissionOverride] = useState<Mission | null>(null);
  const currentMission = selectedMissionOverride ?? activeMission;

  // Retrieve mission details and goals for the selected/active mission
  const {
    mission: detailedMission,
    goals,
    isLoading: isDetailLoading,
  } = useMissionDetail(currentMission?.id);

  // Command hook for dispatching goals & software E-Stop
  const {
    sendSetGoal,
    sendSoftwareEstop,
    lastCommand,
    isLoading: isCommandLoading,
    error: commandError,
    clearError: clearCommandError,
  } = useRobotCommand();

  const [lastCommandType, setLastCommandType] = useState<CommandType | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Derive safety gating conditions
  const isRobotDisconnected =
    !selectedRobot ||
    selectedRobot.connection_status !== 'connected' ||
    (telemetry?.connectionStatus !== undefined && telemetry.connectionStatus !== 'connected');

  const isEmergencyStop =
    telemetry?.safetyState === 'emergency_stop' ||
    telemetry?.safety_state === 'emergency_stop' ||
    latestSafetyEvent?.state === 'emergency_stop';

  const isRobotError = selectedRobot?.status === 'error';
  const isTelemetryStale = Boolean(telemetry?.isStale || telemetry?.is_stale);

  // Deterministic priority ordering for safety gating reason:
  // 1. No robot selected
  // 2. Disconnected robot
  // 3. Emergency stop
  // 4. Robot error
  // 5. Stale telemetry
  let isGoalDisabled = false;
  let safetyReason: string | null = null;

  if (!selectedRobotId || !selectedRobot) {
    isGoalDisabled = true;
    safetyReason = 'Motion commands disabled: No active robot selected.';
  } else if (isRobotDisconnected) {
    isGoalDisabled = true;
    safetyReason = 'Motion commands disabled: Robot is disconnected.';
  } else if (isEmergencyStop) {
    isGoalDisabled = true;
    safetyReason = 'Motion commands disabled: Robot is in emergency stop.';
  } else if (isRobotError) {
    isGoalDisabled = true;
    safetyReason = 'Motion commands disabled: Robot is reporting an error.';
  } else if (isTelemetryStale) {
    isGoalDisabled = true;
    safetyReason = 'Motion commands disabled: Telemetry stream is stale.';
  }

  // E-Stop remains triggerable when a transport connection exists, even if telemetry is stale or robot is unsafe
  const isEstopDisabled = !selectedRobotId || isRobotDisconnected;

  const handleSetGoal = async (coords: SetGoalCoordinates) => {
    if (isGoalDisabled || !selectedRobotId) {
      setFeedbackMessage(safetyReason ?? 'Cannot dispatch goal: Safety gating active.');
      return;
    }

    setLastCommandType('set_goal');
    clearCommandError();

    try {
      const response = await sendSetGoal(
        selectedRobotId,
        {
          frame_id: coords.frameId,
          position: { x: coords.x, y: coords.y, z: coords.z },
          orientation: { x: 0, y: 0, z: 0, w: 1 }, // Safe identity quaternion (no rotation)
        },
        currentMission?.id ?? null,
      );
      setFeedbackMessage(
        `Goal dispatched: Command ${response.status.toUpperCase()} (${response.id})`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage(`Failed to dispatch goal: ${msg}`);
    }
  };

  const handleSoftwareEstop = async () => {
    if (isEstopDisabled || !selectedRobotId) {
      setFeedbackMessage('Cannot trigger E-Stop: Robot transport is not connected.');
      return;
    }

    setLastCommandType('software_estop');
    clearCommandError();

    try {
      const response = await sendSoftwareEstop(
        selectedRobotId,
        true,
        currentMission?.id ?? null,
      );
      setFeedbackMessage(
        `Software E-Stop command dispatched: Status is ${response.status.toUpperCase()}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage(`E-Stop command failed: ${msg}`);
    }
  };

  const isGlobalLoading = isRobotLoading || (Boolean(selectedRobotId) && isMissionsLoading);
  const globalError = robotError || missionsError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-100">Mission Management</h2>
          <p className="text-xs text-slate-400 mt-1">
            Monitor active missions and issue safe UGV operational commands.
          </p>
        </div>
        {selectedRobot && (
          <div className="text-xs font-mono text-slate-400">
            Active Robot: <span className="text-slate-200 font-semibold">{selectedRobot.name}</span> ({selectedRobot.id})
          </div>
        )}
      </div>

      {globalError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-center justify-between">
          <span>Failed to load mission data: {globalError.message}</span>
          <button
            type="button"
            onClick={() => refetchMissions()}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold ml-4"
          >
            Retry
          </button>
        </div>
      )}

      {/* Informative feedback banner when an action is triggered */}
      {feedbackMessage && (
        <div
          className={`p-3 rounded-lg text-xs flex items-center justify-between ${
            feedbackMessage.includes('Failed') || feedbackMessage.includes('Cannot')
              ? 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
              : 'bg-sky-500/10 border border-sky-500/20 text-sky-300'
          }`}
          data-testid="mission-feedback-banner"
        >
          <span>{feedbackMessage}</span>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="text-slate-400 hover:text-slate-200 text-xs font-semibold ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {!selectedRobot && !isRobotLoading ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-lg text-slate-400 text-sm">
          <div className="font-semibold text-slate-300">No Active Robot</div>
          <div className="text-xs mt-1">Connect or select an active robot to manage missions.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <MissionStatus
            mission={detailedMission ?? currentMission}
            isLoading={isGlobalLoading || isDetailLoading}
          />

          <MissionControls
            onSetGoal={handleSetGoal}
            onSoftwareEstop={handleSoftwareEstop}
            commandStatus={lastCommand?.status ?? 'ready'}
            lastCommandType={lastCommandType}
            lastCommandResponse={lastCommand}
            hasActiveMission={Boolean(currentMission)}
            isGoalDisabled={isGoalDisabled}
            isEstopDisabled={isEstopDisabled}
            safetyReason={safetyReason}
            isDispatching={isCommandLoading}
            errorMessage={commandError?.message}
          />

          <MissionGoals
            goals={goals}
            isLoading={isDetailLoading}
          />

          <MissionHistory
            missions={missions}
            isLoading={isMissionsLoading}
            selectedMissionId={currentMission?.id}
            onSelectMission={(m) => setSelectedMissionOverride(m)}
          />
        </div>
      )}
    </div>
  );
};

export default MissionPage;
