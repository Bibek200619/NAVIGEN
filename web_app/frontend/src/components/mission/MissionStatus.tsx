import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { Mission } from '../../types/mission';

export interface MissionStatusProps {
  mission?: Mission | null;
  isLoading?: boolean;
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

export const MissionStatus: React.FC<MissionStatusProps> = ({ mission = null, isLoading = false }) => {
  const statusConfig = mission ? getMissionStatusBadgeConfig(mission.status) : null;

  return (
    <Panel title="Mission Status">
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400">Loading mission status...</div>
      ) : !mission ? (
        <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
          <span className="text-sm font-medium text-slate-300">No active mission</span>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            No mission is currently executing or scheduled.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
            <span className="text-slate-400">Status</span>
            {statusConfig && (
              <StatusBadge status={statusConfig.label} variant={statusConfig.variant} />
            )}
          </div>

          <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Name</span>
              <span className="font-medium text-slate-200">{mission.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Mission ID</span>
              <span className="font-mono text-[11px] text-slate-400 truncate max-w-[200px]" title={mission.id}>
                {mission.id}
              </span>
            </div>
            {mission.description && (
              <div className="pt-1 border-t border-slate-800/80">
                <span className="text-slate-400 block mb-0.5">Description</span>
                <span className="text-slate-300 text-[11px]">{mission.description}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-slate-400">Started</span>
              <span className="text-slate-300 font-mono text-[11px]">
                {formatTimestamp(mission.startedAt)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Completed</span>
              <span className="text-slate-300 font-mono text-[11px]">
                {formatTimestamp(mission.completedAt)}
              </span>
            </div>
            {mission.failureReason && (
              <div className="pt-1 border-t border-rose-900/40 text-rose-300 text-[11px]">
                <span className="font-semibold text-rose-400">Failure Reason: </span>
                {mission.failureReason}
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
};
