import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';

export type CommandType = 'set_goal' | 'software_estop';
export type CommandStatus = 'ready' | 'pending' | 'accepted' | 'executed' | 'rejected' | 'failed';

export interface MissionControlsProps {
  onSetGoal?: () => void;
  onSoftwareEstop?: () => void;
  commandStatus?: CommandStatus;
  lastCommandType?: CommandType | null;
  hasActiveMission?: boolean;
  disabled?: boolean;
}

const getCommandStatusBadgeConfig = (status: CommandStatus) => {
  switch (status) {
    case 'executed':
      return { label: 'Executed', variant: 'success' as const };
    case 'accepted':
      return { label: 'Accepted', variant: 'info' as const };
    case 'pending':
      return { label: 'Pending', variant: 'warning' as const };
    case 'rejected':
      return { label: 'Rejected', variant: 'danger' as const };
    case 'failed':
      return { label: 'Failed', variant: 'danger' as const };
    case 'ready':
    default:
      return { label: 'Ready', variant: 'default' as const };
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
  hasActiveMission = false,
  disabled = false,
}) => {
  const [confirmingEstop, setConfirmingEstop] = useState(false);

  const statusConfig = getCommandStatusBadgeConfig(commandStatus);
  const isPending = commandStatus === 'pending';

  const handleConfirmEstop = () => {
    setConfirmingEstop(false);
    onSoftwareEstop?.();
  };

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

        <div className="space-y-3">
          {/* Canonical Command 1: Set Goal (Mission-dependent) */}
          <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200">Set Goal</div>
              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                {hasActiveMission
                  ? 'Dispatch navigation goal to robot'
                  : 'Requires active mission to dispatch goal'}
              </div>
            </div>
            <button
              type="button"
              onClick={onSetGoal}
              disabled={disabled || !hasActiveMission || isPending}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                !hasActiveMission || disabled || isPending
                  ? 'bg-slate-800/60 text-slate-500 cursor-not-allowed border border-slate-800'
                  : 'bg-sky-600 hover:bg-sky-500 text-white border border-sky-500/50'
              }`}
            >
              Dispatch Goal
            </button>
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
                  disabled={disabled || isPending}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors shrink-0 ${
                    disabled || isPending
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
                    disabled={disabled || isPending}
                    className="px-3 py-1 rounded text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white border border-rose-500/60 transition-colors"
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
