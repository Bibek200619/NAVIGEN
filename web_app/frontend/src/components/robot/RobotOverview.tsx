import React from 'react';
import { Panel } from '../common/Panel';

export const RobotOverview: React.FC = () => {
  return (
    <Panel title="Robot Overview">
      <div className="text-sm text-slate-400">
        NAVIGEN UGV Hardware & State Info
      </div>
    </Panel>
  );
};
