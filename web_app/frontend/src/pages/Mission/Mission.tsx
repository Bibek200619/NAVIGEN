import React, { useState, useMemo } from 'react';
import { RefreshCw, Navigation, ShieldCheck, Wifi } from 'lucide-react';
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
import { StatusBadge } from '../../components/common/StatusBadge';
import type { Mission } from '../../types/mission';
import type { CommandType } from '../../types/api';

const isMissionTerminal = (status?: string | null): boolean => {
  return status === 'completed' || status === 'failed' || status === 'aborted';
};

const isMissionActive = (status?: string | null): boolean => {
  return status === 'in_progress' || status === 'pending';
};

const getHeaderMissionBadgeConfig = (status?: string | null) => {
  switch (status) {
    case 'in_progress':
      return { label: 'IN PROGRESS', variant: 'info' as const };
    case 'completed':
      return { label: 'COMPLETED', variant: 'success' as const };
    case 'pending':
      return { label: 'PENDING', variant: 'warning' as const };
    case 'failed':
      return { label: 'FAILED', variant: 'danger' as const };
    case 'aborted':
      return { label: 'ABORTED', variant: 'danger' as const };
    default:
      return { label: 'UNKNOWN', variant: 'default' as const };
  }
};

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

  const isCurrentMissionTerminal = Boolean(
    currentMission && isMissionTerminal(currentMission.status),
  );
  const isCurrentMissionActive = Boolean(
    currentMission && isMissionActive(currentMission.status),
  );

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
  // 6. Selected mission is terminal (read-only)
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
  } else if (isCurrentMissionTerminal) {
    isGoalDisabled = true;
    safetyReason = `This mission is ${currentMission?.status} and is read-only. Create or select an active mission to dispatch a new goal.`;
  }

  // E-Stop remains triggerable when a transport connection exists, even if telemetry is stale or robot is unsafe
  const isEstopDisabled = !selectedRobotId || isRobotDisconnected;

  const handleSetGoal = async (coords: SetGoalCoordinates) => {
    if (isGoalDisabled || !selectedRobotId || isCurrentMissionTerminal) {
      setFeedbackMessage(
        safetyReason ??
          (isCurrentMissionTerminal
            ? `Cannot dispatch goal: This mission is ${currentMission?.status} and is read-only.`
            : 'Cannot dispatch goal: Safety gating active.'),
      );
      return;
    }

    setLastCommandType('set_goal');
    clearCommandError();

    try {
      const targetMissionId = isCurrentMissionActive ? currentMission?.id : null;
      const response = await sendSetGoal(
        selectedRobotId,
        {
          frame_id: coords.frameId,
          position: { x: coords.x, y: coords.y, z: coords.z },
          orientation: { x: 0, y: 0, z: 0, w: 1 }, // Safe identity quaternion (no rotation)
        },
        targetMissionId,
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
      const targetMissionId = isCurrentMissionActive ? currentMission?.id : null;
      const response = await sendSoftwareEstop(
        selectedRobotId,
        true,
        targetMissionId,
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

  const getQuickSafetyStatus = () => {
    if (!selectedRobotId || !latestSafetyEvent) {
      return { label: 'SAFETY: NOMINAL', variant: 'success' as const };
    }
    switch (latestSafetyEvent.state) {
      case 'ok':
        return { label: 'SAFETY: NOMINAL', variant: 'success' as const };
      case 'warning':
        return { label: 'SAFETY: WARNING', variant: 'warning' as const };
      case 'emergency_stop':
        return { label: 'SAFETY: EMERGENCY STOP', variant: 'danger' as const };
      default:
        return { label: 'SAFETY: UNKNOWN', variant: 'default' as const };
    }
  };

  const quickSafety = getQuickSafetyStatus();
  const headerMissionBadge = currentMission ? getHeaderMissionBadgeConfig(currentMission.status) : null;

  return (
    <div className="space-y-6">
      {/* TOP: Tactical Mission Command Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-lg border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Navigation className="w-5 h-5 text-sky-400" />
              <span>Mission Control</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
              Mission Management
            </span>
          </div>
          {selectedRobot ? (
            <div className="text-xs font-mono text-slate-400">
              Active Robot: <span className="text-slate-200 font-semibold">{selectedRobot.name}</span>{' '}
              <span className="text-slate-500 font-mono">({selectedRobot.id})</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-mono">
              Fleet Status: No active robot selected
            </div>
          )}
          <p className="text-xs text-slate-400 hidden sm:block">
            Monitor active missions and issue safe UGV operational commands.
          </p>
        </div>

        {/* Tactical Quick-Scan Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Mission Status Indicator */}
          {headerMissionBadge ? (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px] font-mono">Status:</span>
              <StatusBadge status={headerMissionBadge.label} variant={headerMissionBadge.variant} />
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs">
              <span className="text-slate-400 text-[11px] font-mono">Status:</span>
              <span className="font-mono text-[11px] text-slate-400 font-semibold">NO ACTIVE MISSION</span>
            </div>
          )}

          {/* Gateway Link Pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs">
            <Wifi className={`w-3.5 h-3.5 ${!isRobotDisconnected ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-slate-400 text-[11px] font-mono">Gateway</span>
            <span
              className={`w-2 h-2 rounded-full ${
                !isRobotDisconnected ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
          </div>

          {/* Safety State Indicator */}
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <StatusBadge status={quickSafety.label} variant={quickSafety.variant} />
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={() => refetchMissions()}
            title="Sync Missions State"
            aria-label="Refresh Missions"
            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
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
            className="text-slate-400 hover:text-slate-200 text-xs font-semibold ml-4 cursor-pointer"
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="space-y-6">
            <MissionStatus
              mission={detailedMission ?? currentMission}
              isLoading={isGlobalLoading || isDetailLoading}
            />

            <MissionGoals
              goals={goals}
              isLoading={isDetailLoading}
            />
          </div>

          <div className="space-y-6">
            <MissionControls
              onSetGoal={handleSetGoal}
              onSoftwareEstop={handleSoftwareEstop}
              commandStatus={lastCommand?.status ?? 'ready'}
              lastCommandType={lastCommandType}
              lastCommandResponse={lastCommand}
              hasActiveMission={isCurrentMissionActive}
              isHistoricalMission={isCurrentMissionTerminal}
              isGoalDisabled={isGoalDisabled}
              isEstopDisabled={isEstopDisabled}
              safetyReason={safetyReason}
              isDispatching={isCommandLoading}
              errorMessage={commandError?.message}
            />

            <MissionHistory
              missions={missions}
              isLoading={isMissionsLoading}
              selectedMissionId={currentMission?.id}
              onSelectMission={(m) => setSelectedMissionOverride(m)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionPage;
