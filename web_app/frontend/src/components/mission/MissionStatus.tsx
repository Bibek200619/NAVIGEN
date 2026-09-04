import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { Mission } from '../../types/mission';

interface MissionStatusProps {
  mission?: Mission | null;
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

export const MissionStatus: React.FC<MissionStatusProps> = ({ mission = null }) => {
  const statusConfig = mission ? getMissionStatusBadgeConfig(mission.status) : null;

  return (
    <Panel title="Mission Status">
      {!mission ? (
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
              <span className="font-mono text-[11px] text-slate-400">{mission.id}</span>
            </div>
            {mission.createdAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Created</span>
                <span className="text-slate-400">{new Date(mission.createdAt).toLocaleString()}</span>
              </div>
            )}
            {mission.updatedAt && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Updated</span>
                <span className="text-slate-400">{new Date(mission.updatedAt).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
};
