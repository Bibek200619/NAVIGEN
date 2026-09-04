import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { WebSocketStatus } from '../../services/websocket';

const getHeaderStatusConfig = (status: WebSocketStatus) => {
  switch (status) {
    case 'connected':
      return {
        label: 'System Online',
        containerClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-400 animate-pulse',
      };
    case 'connecting':
      return {
        label: 'Connecting...',
        containerClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        dotClass: 'bg-sky-400 animate-pulse',
      };
    case 'reconnecting':
      return {
        label: 'Reconnecting...',
        containerClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-400 animate-pulse',
      };
    case 'disconnected':
    default:
      return {
        label: 'System Offline',
        containerClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-400',
      };
  }
};

export const Header: React.FC = () => {
  const { status } = useWebSocket();
  const config = getHeaderStatusConfig(status);

  return (
    <header className="h-16 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-slate-200">UGV Control Interface</h1>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.containerClass}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
          {config.label}
        </span>
      </div>
    </header>
  );
};
