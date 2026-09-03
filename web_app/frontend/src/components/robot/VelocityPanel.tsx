import React from 'react';
import { Panel } from '../common/Panel';

export const VelocityPanel: React.FC = () => {
  return (
    <Panel title="Velocity">
      <div className="text-sm text-slate-400">
        Linear: 0.00 m/s | Angular: 0.00 rad/s
      </div>
    </Panel>
  );
};
