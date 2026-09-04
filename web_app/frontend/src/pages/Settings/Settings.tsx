import React from 'react';
import { Settings, Server, Radio, ShieldCheck } from 'lucide-react';
import { Panel } from '../../components/common/Panel';

export const SettingsPage: React.FC = () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';

  return (
    <div className="space-y-6">
      {/* Tactical Top Command Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-lg border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Settings className="w-5 h-5 text-sky-400" />
              <span>Settings</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
              Configuration
            </span>
          </div>
          <p className="text-xs text-slate-400">
            NAVIGEN Station Parameters & Network Transport Endpoints
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Profile: Production Operator</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Network Endpoints */}
        <Panel title="Application Configuration">
          <div className="space-y-4 text-sm text-slate-400">
            <p className="text-xs text-slate-400 leading-relaxed">
              Active backend REST API gateway and real-time telemetry WebSocket endpoints.
            </p>

            {/* API Base URL */}
            <div className="space-y-1.5">
              <label
                htmlFor="api-url"
                className="block text-xs font-semibold uppercase font-mono text-slate-400 flex items-center gap-1.5"
              >
                <Server className="w-3.5 h-3.5 text-sky-400" />
                <span>API Base URL</span>
              </label>
              <input
                id="api-url"
                type="text"
                readOnly
                value={apiUrl}
                aria-label="API Base URL"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-sky-500 cursor-default"
              />
              <span className="text-[10px] font-mono text-slate-500 block">
                Target: REST v1 OpenAPI Specification
              </span>
            </div>

            {/* WebSocket URL */}
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <label
                htmlFor="ws-url"
                className="block text-xs font-semibold uppercase font-mono text-slate-400 flex items-center gap-1.5"
              >
                <Radio className="w-3.5 h-3.5 text-sky-400" />
                <span>WebSocket URL</span>
              </label>
              <input
                id="ws-url"
                type="text"
                readOnly
                value={wsUrl}
                aria-label="WebSocket URL"
                className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-sky-500 cursor-default"
              />
              <span className="text-[10px] font-mono text-slate-500 block">
                Target: Live Bidirectional Telemetry Bus
              </span>
            </div>
          </div>
        </Panel>

        {/* Runtime Environment Info */}
        <Panel title="Runtime Environment">
          <div className="space-y-3 text-xs font-mono">
            <p className="text-slate-400 font-sans leading-relaxed">
              NAVIGEN ground control station client framework and robotics bridge specifications.
            </p>

            <div className="p-3 bg-slate-950/60 rounded border border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-slate-500">CLIENT APPLICATION:</span>
                <span className="text-slate-200 font-medium">NAVIGEN Web GCS v0.1.0</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-slate-500">RUNTIME PLATFORM:</span>
                <span className="text-slate-200 font-medium">Vite / React 19 / TypeScript</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-slate-500">ROS MIDDLEWARE:</span>
                <span className="text-slate-200 font-medium">ROS 2 Humble Hawksbill</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <span className="text-slate-500">TRANSPORT SECURITY:</span>
                <span className="text-emerald-400 font-medium">Bearer Token / JWT Auth</span>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default SettingsPage;
