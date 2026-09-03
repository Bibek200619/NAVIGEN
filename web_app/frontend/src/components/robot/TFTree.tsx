import React from 'react';
import { Panel } from '../common/Panel';

export const TFTree: React.FC = () => {
  return (
    <Panel title="Transform (TF) Tree">
      <div className="text-sm text-slate-400">
        base_link → camera_link, imu_link, wheel links
      </div>
    </Panel>
  );
};
