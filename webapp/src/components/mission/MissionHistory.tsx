import React from 'react';
import { Panel } from '../common/Panel';

export const MissionHistory: React.FC = () => {
  return (
    <Panel title="Mission History">
      <div className="text-sm text-slate-400">
        No past missions recorded.
      </div>
    </Panel>
  );
};
