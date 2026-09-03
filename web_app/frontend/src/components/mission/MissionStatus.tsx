import React from 'react';
import { Panel } from '../common/Panel';

export const MissionStatus: React.FC = () => {
  return (
    <Panel title="Mission Status">
      <div className="text-sm text-slate-400">
        Current Mission: None active
      </div>
    </Panel>
  );
};
