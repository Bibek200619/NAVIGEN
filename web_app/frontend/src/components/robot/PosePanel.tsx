import React from 'react';
import { Panel } from '../common/Panel';

export const PosePanel: React.FC = () => {
  return (
    <Panel title="Pose (Position & Orientation)">
      <div className="text-sm text-slate-400">
        Position: X: 0.00, Y: 0.00, Z: 0.00 | Yaw: 0.0°
      </div>
    </Panel>
  );
};
