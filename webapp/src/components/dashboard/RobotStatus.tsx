import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';

export const RobotStatus: React.FC = () => {
  return (
    <Panel title="Robot Status">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-400">Status</span>
        <StatusBadge status="Ready" variant="success" />
      </div>
    </Panel>
  );
};
