import React from 'react';
import { History, Clock, AlertCircle } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import type { Mission } from '../../types/mission';

export interface MissionHistoryProps {
  missions?: Mission[];
  isLoading?: boolean;
  onSelectMission?: (mission: Mission) => void;
  selectedMissionId?: string | null;
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
  className = '',
}) => {
  return (
    <Panel title="Mission History" className={className}>
      {isLoading ? (
        <div className="py-6 text-center text-xs text-slate-400">Loading mission history...</div>
      ) : missions.length === 0 ? (
        <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
          <History className="w-8 h-8 text-slate-600 mb-2" />
          <span className="text-sm font-medium text-slate-300">No mission records</span>
          <p className="text-xs text-slate-500 mt-1 max-w-xs">
            No past missions recorded for this robot.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {missions.map((mission) => {
            const badge = getMissionStatusBadgeConfig(mission.status);
            const isSelected = selectedMissionId === mission.id;
            const isActive = mission.status === 'in_progress' || mission.status === 'pending';

            return (
              <div
                key={mission.id}
                role="button"
                tabIndex={0}
                aria-label={`Select mission ${mission.name}`}
                onClick={() => onSelectMission?.(mission)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectMission?.(mission);
                  }
                }}
                className={`p-3 rounded-md border text-xs transition-all cursor-pointer select-none focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                  isSelected
                    ? 'bg-slate-900/90 border-sky-500/60 shadow-sm ring-1 ring-sky-500/30'
                    : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/60 hover:border-slate-700/80'
                }`}
              >
                {/* Header: Name, Active/Historical Tag, and StatusBadge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-semibold text-slate-200 truncate">{mission.name}</span>
                    <span
                      className={`text-[9px] font-mono uppercase px-1 py-0.2 rounded border ${
                        isActive
                          ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {isActive ? 'Active' : 'Archived'}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <StatusBadge status={badge.label} variant={badge.variant} />
                  </div>
                </div>

                {/* Mission ID */}
                <div className="mt-1 text-[10px] font-mono text-slate-500 truncate" title={mission.id}>
                  ID: <span className="text-slate-400">{mission.id}</span>
                </div>

                {/* Timestamps Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1 truncate">
                    <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="text-slate-500">Created: </span>
                    <span className="font-mono text-slate-300 truncate">
                      {formatTime(mission.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 truncate">
                    <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                    <span className="text-slate-500">Completed: </span>
                    <span className="font-mono text-slate-300 truncate">
                      {formatTime(mission.completedAt)}
                    </span>
                  </div>
                </div>

                {/* Failure Reason */}
                {mission.failureReason && (
                  <div className="mt-2 p-2 bg-rose-950/30 border border-rose-900/40 rounded text-[11px] text-rose-300 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                    <div>
                      <span className="text-rose-500 font-semibold">Error: </span>
                      <span>{mission.failureReason}</span>
                    </div>
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
