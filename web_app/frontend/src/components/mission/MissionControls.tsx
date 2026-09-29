import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Navigation, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
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
  isHistoricalMission?: boolean;
  disabled?: boolean;
  isDispatching?: boolean;
  errorMessage?: string | null;
  isGoalDisabled?: boolean;
  isEstopDisabled?: boolean;
  safetyReason?: string | null;
  className?: string;
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
  isHistoricalMission = false,
  disabled = false,
  isDispatching = false,
  errorMessage = null,
  isGoalDisabled = false,
  isEstopDisabled = false,
  safetyReason = null,
  className = '',
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
  const isXValid = !isNaN(numX) && Number.isFinite(numX);
  const isYValid = !isNaN(numY) && Number.isFinite(numY);
  const isZValid = !isNaN(numZ) && Number.isFinite(numZ);
  const isFrameValid = frameId.trim().length > 0;
  const areCoordinatesValid = isXValid && isYValid && isZValid && isFrameValid;

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

  const isTerminalFailure = commandStatus === 'rejected' || commandStatus === 'failed';

  return (
    <Panel title="Mission Controls" className={className}>
      <div className="space-y-4">
        {/* Command Lifecycle Status Header */}
        <div className="space-y-2.5 pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 font-medium">
              Command Status
              {lastCommandType ? ` (${formatCommandName(lastCommandType)})` : ''}:
            </span>
            <StatusBadge status={statusConfig.label} variant={statusConfig.variant} />
          </div>

          {/* Visual Lifecycle Progression Pipeline */}
          <div className="p-2 bg-slate-950/80 rounded border border-slate-800/80 flex items-center justify-between gap-1 text-[10px] font-mono overflow-x-auto min-w-0">
            {/* Step 1: Ready */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                commandStatus === 'ready'
                  ? 'bg-slate-800 text-slate-100 font-semibold border border-slate-700'
                  : 'text-slate-500'
              }`}
            >
              <span>1. Ready</span>
            </div>

            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />

            {/* Step 2: Pending */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                commandStatus === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-slate-500'
              }`}
            >
              <span>2. Pending</span>
            </div>

            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />

            {/* Step 3: Accepted */}
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                commandStatus === 'accepted'
                  ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                  : 'text-slate-500'
              }`}
            >
              <span>3. Accepted</span>
            </div>

            <ArrowRight className="w-3 h-3 text-slate-600 shrink-0" />

            {/* Step 4: Executed or Terminal Failure */}
            {isTerminalFailure ? (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30">
                <XCircle className="w-3 h-3" />
                <span>4. {commandStatus === 'rejected' ? 'Rejected' : 'Failed'}</span>
              </div>
            ) : (
              <div
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
                  commandStatus === 'executed'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30'
                    : 'text-slate-500'
                }`}
              >
                {commandStatus === 'executed' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                <span>4. Executed</span>
              </div>
            )}
          </div>
        </div>

        {/* Reason Banner if rejected/failed */}
        {reason && (
          <div
            className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-300 space-y-0.5"
            data-testid="command-reason-banner"
          >
            <div className="font-semibold text-rose-400 text-[11px] uppercase tracking-wider">
              {commandStatus === 'rejected' ? 'Command Rejection' : 'Command Failure'}
            </div>
            <div className="text-[11px] leading-relaxed">{reason}</div>
          </div>
        )}

        <div className="space-y-4">
          {/* Canonical Command 1: Set Goal (Safe Coordinate Input) */}
          <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Navigation className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-200">
                  Dispatch Navigation Goal
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                {hasActiveMission
                  ? 'Active Mission'
                  : isHistoricalMission
                  ? 'Historical (Read-Only)'
                  : 'Standalone / Ad-hoc'}
              </span>
            </div>

            {/* Safety Warning Banner when goal dispatch is locked */}
            {safetyReason && (
              <div
                className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-300 flex items-center gap-2"
                data-testid="safety-lockout-banner"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="leading-snug">{safetyReason}</span>
              </div>
            )}

            <form onSubmit={handleDispatchGoal} className="space-y-3">
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div>
                  <label htmlFor="goal-x" className="block text-[11px] font-mono text-slate-400 mb-1">
                    X (m)
                  </label>
                  <input
                    id="goal-x"
                    type="number"
                    step="any"
                    value={xInput}
                    onChange={(e) => setXInput(e.target.value)}
                    disabled={goalDisabled}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isXValid && (
                    <span className="text-[10px] text-rose-400 mt-0.5 block">Invalid number</span>
                  )}
                </div>

                <div>
                  <label htmlFor="goal-y" className="block text-[11px] font-mono text-slate-400 mb-1">
                    Y (m)
                  </label>
                  <input
                    id="goal-y"
                    type="number"
                    step="any"
                    value={yInput}
                    onChange={(e) => setYInput(e.target.value)}
                    disabled={goalDisabled}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isYValid && (
                    <span className="text-[10px] text-rose-400 mt-0.5 block">Invalid number</span>
                  )}
                </div>

                <div>
                  <label htmlFor="goal-z" className="block text-[11px] font-mono text-slate-400 mb-1">
                    Z (m)
                  </label>
                  <input
                    id="goal-z"
                    type="number"
                    step="any"
                    value={zInput}
                    onChange={(e) => setZInput(e.target.value)}
                    disabled={goalDisabled}
                    className="w-full px-2 py-1.5 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isZValid && (
                    <span className="text-[10px] text-rose-400 mt-0.5 block">Invalid number</span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-1">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <label htmlFor="goal-frame" className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
                    Frame:
                  </label>
                  <input
                    id="goal-frame"
                    type="text"
                    value={frameId}
                    onChange={(e) => setFrameId(e.target.value)}
                    disabled={goalDisabled}
                    className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded text-xs text-slate-200 font-mono w-28 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  {!isFrameValid && (
                    <span className="text-[10px] text-rose-400 whitespace-nowrap">Required</span>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={goalDisabled || !areCoordinatesValid}
                  className={`px-3.5 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                    goalDisabled || !areCoordinatesValid
                      ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                      : 'bg-sky-600 hover:bg-sky-500 text-white border border-sky-500/50 focus:ring-1 focus:ring-sky-400 cursor-pointer'
                  }`}
                >
                  {isPending ? 'Sending...' : 'Dispatch Goal'}
                </button>
              </div>
            </form>
          </div>

          {/* Canonical Command 2: Software E-Stop (Safety Critical) */}
          <div className="p-3 bg-rose-950/20 rounded-md border border-rose-900/40 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
              <div className="flex items-start gap-2.5 min-w-0">
                <ShieldAlert className="w-4 h-4 text-rose-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-rose-200 flex items-center gap-2">
                    <span className="uppercase tracking-wider">SOFTWARE E-STOP</span>
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
                  className={`px-3.5 py-1.5 rounded text-xs font-semibold uppercase tracking-wider transition-colors shrink-0 ${
                    estopDisabled
                      ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                      : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/50 shadow-sm focus:ring-1 focus:ring-rose-400 cursor-pointer'
                  }`}
                >
                  Trigger E-Stop
                </button>
              )}
            </div>

            {/* Explicit User Confirmation Gate */}
            {confirmingEstop && (
              <div className="pt-2.5 border-t border-rose-900/40 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
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
                        : 'bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/60 focus:ring-1 focus:ring-rose-400 cursor-pointer'
                    }`}
                  >
                    Confirm Stop
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingEstop(false)}
                    className="px-3 py-1 rounded text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
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
