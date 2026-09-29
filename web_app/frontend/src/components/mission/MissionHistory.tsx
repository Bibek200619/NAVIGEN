import React from 'react';
import { AlertCircle, Clock, History } from 'lucide-react';
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
  const date = new Date(ts);
  return Number.isNaN(date.getTime()) ? ts : date.toLocaleString();
};

export const MissionHistory: React.FC<MissionHistoryProps> = ({
  missions = [],
  isLoading = false,
  onSelectMission,
  selectedMissionId,
  className = '',
}) => (
  <Panel title="Mission History" className={className}>
    {isLoading ? (
      <div className="muted-note">Loading mission history…</div>
    ) : missions.length === 0 ? (
      <div className="muted-note">No past missions recorded for this robot.</div>
    ) : (
      <div className="mission-history-list">
        {missions.map((mission) => {
          const badge = getMissionStatusBadgeConfig(mission.status);
          const content = (
            <>
              <div className="mission-history-heading">
                <strong>{mission.name}</strong>
                <StatusBadge status={badge.label} variant={badge.variant} />
              </div>
              <div className="mission-history-meta">
                <span><History size={13} /> Started {formatTime(mission.createdAt)}</span>
                {mission.completedAt && <span><Clock size={13} /> Finished {formatTime(mission.completedAt)}</span>}
              </div>
              {mission.failureReason && (
                <span className="mission-history-error"><AlertCircle size={13} /> {mission.failureReason}</span>
              )}
            </>
          );
          return onSelectMission ? (
            <button
              type="button"
              key={mission.id}
              className={`mission-history-item ${selectedMissionId === mission.id ? 'selected' : ''}`}
              onClick={() => onSelectMission(mission)}
            >
              {content}
            </button>
          ) : (
            <article
              key={mission.id}
              className={`mission-history-item ${selectedMissionId === mission.id ? 'selected' : ''}`}
            >
              {content}
            </article>
          );
        })}
      </div>
    )}
  </Panel>
);
