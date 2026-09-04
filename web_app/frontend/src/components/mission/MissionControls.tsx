import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Navigation } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { CommandType, CommandStatus, CommandResponse } from '../../types/api';

export interface SetGoalCoordinates {
  x: number;
  y: number;
  z: number;
  frameId: string;
}

export interface MissionControlsProps {
  onSetGoal?: (coords: SetGoalCoordinates) => void;
  onSoftwareEstop?: () => void;
  commandStatus?: CommandStatus | 'ready';
  lastCommandType?: CommandType | null;
  lastCommandResponse?: CommandResponse | null;
  hasActiveMission?: boolean;
  disabled?: boolean;
  isDispatching?: boolean;
  errorMessage?: string | null;
  isGoalDisabled?: boolean;
  isEstopDisabled?: boolean;
  safetyReason?: string | null;
}

const getCommandStatusBadgeConfig = (status: CommandStatus | 'ready') => {
  switch (status) {
    case 'executed':
      return { label: 'EXECUTED', variant: 'success' as const };
    case 'accepted':
      return { label: 'ACCEPTED', variant: 'info' as const };
    case 'pending':
      return { label: 'PENDING', variant: 'warning' as const };
    case 'rejected':
      return { label: 'REJECTED', variant: 'danger' as const };
    case 'failed':
      return { label: 'FAILED', variant: 'danger' as const };
    case 'ready':
    default:
      return { label: 'READY', variant: 'default' as const };
  }
};

const formatCommandName = (commandType: CommandType): string => {
  switch (commandType) {
    case 'set_goal':
      return 'Set Goal';
    case 'software_estop':
      return 'Software E-Stop';
    default:
      return commandType;
  }
};

export const MissionControls: React.FC<MissionControlsProps> = ({
  onSetGoal,
  onSoftwareEstop,
  commandStatus = 'ready',
  lastCommandType = null,
  lastCommandResponse = null,
  hasActiveMission = false,
  disabled = false,
  isDispatching = false,
  errorMessage = null,
  isGoalDisabled = false,
  isEstopDisabled = false,
  safetyReason = null,
}) => {
  const [confirmingEstop, setConfirmingEstop] = useState(false);
  const [xInput, setXInput] = useState<string>('0.0');
  const [yInput, setYInput] = useState<string>('0.0');
  const [zInput, setZInput] = useState<string>('0.0');
  const [frameId, setFrameId] = useState<string>('map');

  const statusConfig = getCommandStatusBadgeConfig(commandStatus);
  const isPending = isDispatching || commandStatus === 'pending';
  const goalDisabled = disabled || isGoalDisabled || isPending;
  const estopDisabled = disabled || isEstopDisabled || isPending;

  // Coordinate validation
  const numX = parseFloat(xInput);
  const numY = parseFloat(yInput);
  const numZ = parseFloat(zInput);
  const areCoordinatesValid =
    !isNaN(numX) &&
    Number.isFinite(numX) &&
    !isNaN(numY) &&
    Number.isFinite(numY) &&
    !isNaN(numZ) &&
    Number.isFinite(numZ) &&
    frameId.trim().length > 0;

  const handleDispatchGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areCoordinatesValid || goalDisabled) return;
    onSetGoal?.({
      x: numX,
      y: numY,
      z: numZ,
      frameId: frameId.trim(),
    });
  };

  const handleConfirmEstop = () => {
    if (estopDisabled) return;
    setConfirmingEstop(false);
    onSoftwareEstop?.();
  };

  const reason =
    lastCommandResponse?.rejection_reason ||
    lastCommandResponse?.failure_reason ||
    errorMessage;

  return (
    <Panel title="Mission Controls">
      <div className="space-y-4">
        {/* Command Lifecycle Status */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
          <span className="text-slate-400">
            Command Status
            {lastCommandType ? ` (${formatCommandName(lastCommandType)})` : ''}:
          </span>
          <StatusBadge status={statusConfig.label} variant={statusConfig.variant} />
        </div>

        {reason && (
          <div
            className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-300"
            data-testid="command-reason-banner"
          >
            {reason}
          </div>
        )}

        <div className="space-y-4">
          {/* Canonical Command 1: Set Goal (Safe Coordinate Input) */}
          <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-200">Dispatch Navigation Goal</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {hasActiveMission ? 'Active Mission' : 'Standalone / Ad-hoc'}
              </span>
            </div>

            {/* Safety Warning Banner when goal dispatch is locked */}
            {safetyReason && (
              <div
                className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300 flex items-center gap-2"
                data-testid="safety-lockout-banner"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{safetyReason}</span>
              </div>
            )}

            <form onSubmit={handleDispatchGoal} className="space-y-2.5">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label htmlFor="goal-x" className="block text-[11px] text-slate-400 mb-1">
                    X (m)
                  </label>
                  <input
                    id="goal-x"
                    type="number"
                    step="any"
                    value={xInput}
                    onChange={(e) => setXInput(e.target.value)}
                    disabled={goalDisabled}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="goal-y" className="block text-[11px] text-slate-400 mb-1">
                    Y (m)
                  </label>
                  <input
                    id="goal-y"
                    type="number"
                    step="any"
                    value={yInput}
                    onChange={(e) => setYInput(e.target.value)}
                    disabled={goalDisabled}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="goal-z" className="block text-[11px] text-slate-400 mb-1">
                    Z (m)
                  </label>
                  <input
                    id="goal-z"
                    type="number"
                    step="any"
                    value={zInput}
                    onChange={(e) => setZInput(e.target.value)}
                    disabled={goalDisabled}
                    className="w-full px-2 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <label htmlFor="goal-frame" className="text-[11px] text-slate-400 whitespace-nowrap">
                    Frame:
                  </label>
                  <input
                    id="goal-frame"
                    type="text"
                    value={frameId}
                    onChange={(e) => setFrameId(e.target.value)}
                    disabled={goalDisabled}
                    className="px-2 py-0.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono w-24 focus:outline-none focus:border-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <button
                  type="submit"
                  disabled={goalDisabled || !areCoordinatesValid}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                    goalDisabled || !areCoordinatesValid
                      ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                      : 'bg-sky-600 hover:bg-sky-500 text-white border border-sky-500/50'
                  }`}
                >
                  {isPending ? 'Sending...' : 'Dispatch Goal'}
                </button>
              </div>
            </form>
          </div>

          {/* Canonical Command 2: Software E-Stop (Safety Critical) */}
          <div className="p-3 bg-rose-950/20 rounded-md border border-rose-900/40 space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-rose-200 flex items-center gap-2">
                    <span>Software E-Stop</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      Safety Critical
                    </span>
                  </div>
                  <div className="text-[11px] text-rose-300/70 mt-0.5">
                    Immediately commands UGV software motion stop
                  </div>
                </div>
              </div>

              {!confirmingEstop && (
                <button
                  type="button"
                  onClick={() => setConfirmingEstop(true)}
                  disabled={estopDisabled}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                    estopDisabled
                      ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50'
                  }`}
                >
                  Trigger E-Stop
                </button>
              )}
            </div>

            {/* Explicit User Confirmation Gate */}
            {confirmingEstop && (
              <div className="pt-2.5 border-t border-rose-900/40 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-rose-300">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Confirm: Trigger emergency software stop?</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmEstop}
                    disabled={estopDisabled}
                    className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
                      estopDisabled
                        ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                        : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/60'
                    }`}
                  >
                    Confirm Stop
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingEstop(false)}
                    className="px-3 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
};
