import React from 'react';
import { Panel } from '../../components/common/Panel';

export const LogsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-100">System Logs</h2>
      <Panel title="Recent Logs">
        <div className="font-mono text-xs text-slate-400 bg-slate-950 p-4 rounded border border-slate-800 space-y-1">
          <p>[INFO] [system]: System initialized successfully</p>
          <p>[INFO] [frontend]: Webapp foundation ready</p>
        </div>
      </Panel>
    </div>
  );
};

export default LogsPage;
