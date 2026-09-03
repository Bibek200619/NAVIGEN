import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { ROS_TOPICS } from '../../constants/topics';

export const TFStatus: React.FC = () => {
  return (
    <Panel title="TF Status">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{ROS_TOPICS.TF}</span>
        <StatusBadge status="Active" variant="success" />
      </div>
    </Panel>
  );
};
