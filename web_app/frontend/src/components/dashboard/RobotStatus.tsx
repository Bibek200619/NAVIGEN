import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { useRobot } from '../../hooks/useRobot';
import type {
  RobotConnectionStatus,
  RobotStatus as RobotStatusType,
} from '../../types/robot';
import type { WebSocketStatus } from '../../services/websocket';

const getConnectionBadgeConfig = (status: WebSocketStatus) => {
  switch (status) {
    case 'connected':
      return { label: 'Connected', variant: 'success' as const };
    case 'connecting':
      return { label: 'Connecting', variant: 'info' as const };
    case 'reconnecting':
      return { label: 'Reconnecting', variant: 'warning' as const };
    case 'disconnected':
    default:
      return { label: 'Disconnected', variant: 'danger' as const };
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

const getRobotConnectionBadgeConfig = (status?: RobotConnectionStatus) => {
  switch (status) {
    case 'connected':
      return { label: 'Connected', variant: 'success' as const };
    case 'connecting':
      return { label: 'Connecting', variant: 'info' as const };
    case 'disconnected':
      return { label: 'Disconnected', variant: 'danger' as const };
    default:
      return { label: 'Unavailable', variant: 'default' as const };
  }
};

export const RobotStatus: React.FC = () => {
  const { robotState, connectionStatus } = useRobot();
  const connectionConfig = getConnectionBadgeConfig(connectionStatus);
  const robotStatusConfig = getRobotStatusBadgeConfig(robotState?.status);
  const robotConnectionConfig = getRobotConnectionBadgeConfig(robotState?.connectionStatus);
  const telemetryConfig =
    robotState === null || robotState.isStale === undefined
      ? { label: 'Unavailable', variant: 'default' as const }
      : robotState.isStale
      ? { label: 'Stale', variant: 'warning' as const }
      : { label: 'Live', variant: 'success' as const };

  return (
    <Panel title="Robot Status">
      <div className="space-y-4">
        {/* Status header row */}
        <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Gateway:</span>
            <StatusBadge status={connectionConfig.label} variant={connectionConfig.variant} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Robot link:</span>
            <StatusBadge status={robotConnectionConfig.label} variant={robotConnectionConfig.variant} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Robot status:</span>
            <StatusBadge status={robotStatusConfig.label} variant={robotStatusConfig.variant} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Telemetry:</span>
            <StatusBadge status={telemetryConfig.label} variant={telemetryConfig.variant} />
          </div>
        </div>

        {/* Main robot content */}
        {robotState === null ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            <span className="text-sm font-medium text-slate-300">No robot telemetry</span>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {connectionStatus === 'connected'
                ? 'Connected to gateway. Waiting for robot telemetry packets...'
                : connectionStatus === 'connecting'
                ? 'Connecting to WebSocket service...'
                : connectionStatus === 'reconnecting'
                ? 'Connection lost. Attempting to reconnect...'
                : 'WebSocket disconnected. Robot telemetry unavailable.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Robot ID */}
            <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-md border border-slate-800 text-xs">
              <span className="text-slate-400">Robot ID</span>
              <span className="font-mono text-slate-200">{robotState.id || '--'}</span>
            </div>

            {/* Velocities grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Linear Velocity</div>
                <div className="text-base font-semibold text-slate-100">
                  {robotState.velocity?.linear !== undefined
                    ? robotState.velocity.linear.toFixed(2)
                    : '--'}
                  <span className="text-xs font-normal text-slate-500 ml-1">m/s</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Angular Velocity</div>
                <div className="text-base font-semibold text-slate-100">
                  {robotState.velocity?.angular !== undefined
                    ? robotState.velocity.angular.toFixed(2)
                    : '--'}
                  <span className="text-xs font-normal text-slate-500 ml-1">rad/s</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
};
