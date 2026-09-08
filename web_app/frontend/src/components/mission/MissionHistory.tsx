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
    <Panel title="Mission History">
      <div className="muted-note">Mission history is not connected.</div>
    </Panel>
  );
};
