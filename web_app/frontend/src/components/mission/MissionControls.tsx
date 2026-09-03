import React from 'react';
import { Panel } from '../common/Panel';

export const MissionControls: React.FC = () => {
  return (
    <Panel title="Mission Controls">
      <div className="flex gap-2">
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-sm font-medium transition-colors"
        >
          Start Mission
        </button>
        <button
          type="button"
          className="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium transition-colors"
        >
          Abort Mission
        </button>
      </div>
    </Panel>
  );
};
