import React from 'react';
import { Panel } from '../../components/common/Panel';

export const SettingsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-100">Settings</h2>
      <Panel title="Application Configuration">
        <div className="space-y-4 text-sm text-slate-400">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              API Base URL
            </label>
            <input
              type="text"
              readOnly
              value={import.meta.env.VITE_API_URL || 'http://localhost:8000'}
              aria-label="API Base URL"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
              WebSocket URL
            </label>
            <input
              type="text"
              readOnly
              value={import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws'}
              aria-label="WebSocket URL"
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-300 font-mono text-xs focus:outline-none"
            />
          </div>
        </div>
      </Panel>
    </div>
  );
};

export default SettingsPage;
