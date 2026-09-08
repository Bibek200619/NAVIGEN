import React from 'react';
import { Flag, Clock, AlertTriangle } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { Mission } from '../../types/mission';

export interface MissionStatusProps {
  mission?: Mission | null;
  isLoading?: boolean;
  className?: string;
}

const getMissionStatusBadgeConfig = (status: Mission['status']) => {
  switch (status) {
    case 'in_progress':
      return { label: 'In Progress', variant: 'info' as const };
    case 'completed':
      return { label: 'Completed', variant: 'success' as const };
    case 'pending':
      return { label: 'Pending', variant: 'warning' as const };
    case 'failed':
      return { label: 'Failed', variant: 'danger' as const };
    case 'aborted':
      return { label: 'Aborted', variant: 'danger' as const };
    default:
      return { label: 'Unknown', variant: 'default' as const };
  }
};

const formatTimestamp = (timestamp?: string | null): string => {
  if (!timestamp) return 'None';
  try {
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? timestamp : d.toLocaleString();
  } catch {
    return timestamp;
  }
};

export const MissionStatus: React.FC<MissionStatusProps> = ({
  mission = null,
  isLoading = false,
  className = '',
}) => {
  const statusConfig = mission ? getMissionStatusBadgeConfig(mission.status) : null;
  const isInProgress = mission?.status === 'in_progress';

  return (
    <Panel title="Mission Status" className={className}>
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading mission status...</div>
      ) : !mission ? (
        <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
          <Flag className="w-8 h-8 text-slate-600 mb-2" />
          <span className="text-sm font-medium text-slate-300">No active mission</span>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            No mission is currently executing or scheduled.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Header Strip: Mission Identity & Status Badge */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-slate-100 tracking-tight truncate">
                  {mission.name}
                </span>
                {isInProgress && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    LIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                <span className="text-slate-500">ID:</span>
                <span className="text-slate-300 truncate max-w-[220px]" title={mission.id}>
                  {mission.id}
                </span>
              </div>
            </div>

            {statusConfig && (
              <div className="shrink-0">
                <StatusBadge status={statusConfig.label} variant={statusConfig.variant} />
              </div>
            )}
          </div>

          {/* Description Callout if available */}
          {mission.description && (
            <div className="p-2.5 bg-slate-950/60 rounded-md border border-slate-800/80 text-xs text-slate-300">
              <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-0.5">
                Description
              </span>
              <span className="text-[11px] leading-relaxed">{mission.description}</span>
            </div>
          )}

          {/* Timing & Execution Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 bg-slate-950/60 rounded-md border border-slate-800 text-xs">
            <div>
              <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Started</span>
              </div>
              <div className="font-mono text-slate-200 mt-0.5 text-[11px]">
                {formatTimestamp(mission.startedAt)}
              </div>
            </div>

            <div>
              <div className="text-slate-500 text-[10px] uppercase font-mono tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-500" />
                <span>Completed</span>
              </div>
              <div className="font-mono text-slate-200 mt-0.5 text-[11px]">
                {formatTimestamp(mission.completedAt)}
              </div>
            </div>

            {mission.createdAt && (
              <div className="col-span-1 sm:col-span-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                  Created Record
                </span>
                <span className="font-mono text-slate-400">
                  {formatTimestamp(mission.createdAt)}
                </span>
              </div>
            )}
          </div>

          {/* Failure Alert Callout if failed */}
          {mission.failureReason && (
            <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-md text-xs text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-rose-400 text-[11px] uppercase tracking-wider">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                <span>Failure Reason</span>
              </div>
              <p className="text-[11px] text-rose-200 leading-normal pl-5">
                {mission.failureReason}
              </p>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
};
