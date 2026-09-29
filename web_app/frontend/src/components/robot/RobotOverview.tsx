import React from 'react';
import { Bot, Wifi } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { useRobot } from '../../hooks/useRobot';
import type { RobotStatus as RobotStatusType } from '../../types/robot';
import type { WebSocketStatus } from '../../services/websocket';

const getGatewayStatusBadgeConfig = (status: WebSocketStatus) => {
  switch (status) {
    case 'connected':
      return { label: 'Connected', variant: 'success' as const };
    case 'connecting':
      return { label: 'Connecting', variant: 'info' as const };
    case 'reconnecting':
      return { label: 'Reconnecting', variant: 'warning' as const };
    case 'disconnected':
    default:
      return { label: 'Offline', variant: 'danger' as const };
  }
};

const getRobotStatusBadgeConfig = (status?: RobotStatusType) => {
  if (!status) {
    return { label: 'Status unavailable', variant: 'default' as const };
  }

  const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
  switch (status) {
    case 'idle':
      return { label: capitalized, variant: 'info' as const };
    case 'navigating':
    case 'manual':
      return { label: capitalized, variant: 'success' as const };
    case 'error':
      return { label: capitalized, variant: 'danger' as const };
    case 'offline':
    default:
      return { label: capitalized, variant: 'default' as const };
  }
};

export const RobotOverview: React.FC = () => {
  const { robotState, connectionStatus } = useRobot();
  const gatewayConfig = getGatewayStatusBadgeConfig(connectionStatus);
  const robotStatusConfig = getRobotStatusBadgeConfig(robotState?.status);

  return (
    <Panel title="Robot Overview">
      <div className="space-y-4">
        {/* Status Header Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Wifi className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-mono text-[11px]">Gateway:</span>
            <StatusBadge status={gatewayConfig.label} variant={gatewayConfig.variant} />
          </div>
          <div className="flex items-center gap-2">
            <Bot className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-mono text-[11px]">Robot Status:</span>
            <StatusBadge status={robotStatusConfig.label} variant={robotStatusConfig.variant} />
          </div>
        </div>

        {/* Content */}
        {!robotState ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            <Bot className="w-8 h-8 text-slate-600 mb-2" />
            <span className="text-sm font-medium text-slate-300">No robot telemetry</span>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              {connectionStatus === 'connected'
                ? 'Connected to gateway. Waiting for robot telemetry packets...'
                : connectionStatus === 'connecting'
                ? 'Connecting to gateway service...'
                : connectionStatus === 'reconnecting'
                ? 'Connection lost. Attempting to reconnect...'
                : 'Gateway is offline. Robot telemetry unavailable.'}
            </p>
          </div>
        ) : (
          <div className="p-3.5 bg-slate-950/60 rounded-md border border-slate-800 space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-mono text-[11px]">Robot ID</span>
              <span className="font-mono text-slate-200 font-medium">
                {robotState.id || '--'}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-800/60">
              <span className="text-slate-400 font-mono text-[11px]">Robot State</span>
              <span className="text-slate-500 italic text-[11px]">Status unavailable</span>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
};
