import React from 'react';
import { Panel } from '../common/Panel';

export const CameraPreview: React.FC = () => {
  return (
    <Panel title="Camera Preview">
      <div className="h-48 flex items-center justify-center bg-slate-950 rounded border border-slate-800 text-slate-500 text-sm">
        Live Feed Placeholder
      </div>
    </Panel>
  );
};
