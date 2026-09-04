import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { Mission } from '../../types/mission';

export interface MissionHistoryProps {
  missions?: Mission[];
  isLoading?: boolean;
  onSelectMission?: (mission: Mission) => void;
  selectedMissionId?: string | null;
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

const formatTime = (ts?: string | null): string => {
  if (!ts) return '--';
  try {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? ts : d.toLocaleString();
  } catch {
    return ts;
  }
};

export const MissionHistory: React.FC<MissionHistoryProps> = ({
  missions = [],
  isLoading = false,
  onSelectMission,
  selectedMissionId,
}) => {
  return (
    <Panel title="Mission History">
      {isLoading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading mission history...</div>
      ) : missions.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-500">
          No past missions recorded for this robot.
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {missions.map((mission) => {
            const badge = getMissionStatusBadgeConfig(mission.status);
            const isSelected = selectedMissionId === mission.id;

            return (
              <div
                key={mission.id}
                onClick={() => onSelectMission?.(mission)}
                className={`p-3 rounded-md border text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-slate-800/80 border-sky-500/50'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/80'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-slate-200 truncate">{mission.name}</div>
                  <StatusBadge status={badge.label} variant={badge.variant} />
                </div>

                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <div>
                    <span className="text-slate-500">Created: </span>
                    <span>{formatTime(mission.createdAt)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500">Completed: </span>
                    <span>{formatTime(mission.completedAt)}</span>
                  </div>
                </div>

                {mission.failureReason && (
                  <div className="mt-1.5 text-[11px] text-rose-400">
                    <span className="text-rose-500 font-semibold">Error: </span>
                    {mission.failureReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
};
