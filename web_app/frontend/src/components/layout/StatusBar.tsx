import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { WebSocketStatus } from '../../services/websocket';

const getGatewayStatusConfig = (status: WebSocketStatus) => {
  switch (status) {
    case 'connected':
      return {
        label: 'Gateway: Connected',
        dotColor: 'bg-emerald-400',
        textColor: 'text-emerald-400',
      };
    case 'connecting':
      return {
        label: 'Gateway: Connecting',
        dotColor: 'bg-sky-400',
        textColor: 'text-sky-400',
      };
    case 'reconnecting':
      return {
        label: 'Gateway: Reconnecting',
        dotColor: 'bg-amber-400',
        textColor: 'text-amber-400',
      };
    case 'disconnected':
    default:
      return {
        label: 'Gateway: Offline',
        dotColor: 'bg-rose-400',
        textColor: 'text-rose-400',
      };
  }
};

export const StatusBar: React.FC = () => {
  const { status } = useWebSocket();
  const config = getGatewayStatusConfig(status);

  return (
    <footer className="h-8 bg-slate-950 border-t border-slate-800 px-6 flex items-center justify-between text-xs text-slate-500">
      <span>NAVIGEN Frontend v0.1.0</span>
      <span className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
        <span className={config.textColor}>{config.label}</span>
      </span>
    </footer>
  );
};
