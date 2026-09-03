import React from 'react';
import { Panel } from '../common/Panel';

export const CameraViewer: React.FC = () => {
  return (
    <Panel title="Primary Camera Stream">
      <div className="aspect-video w-full flex items-center justify-center bg-slate-950 rounded border border-slate-800 text-slate-500">
        Camera Stream Viewport
      </div>
    </Panel>
  );
};
