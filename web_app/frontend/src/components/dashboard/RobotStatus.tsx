import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { useRobot } from '../../hooks/useRobot';
import { useRobotData } from '../../hooks/useRobotData';
import type { Robot } from '../../types/api';
import type {
  RobotConnectionStatus,
  RobotStatus as RobotStatusType,
} from '../../types/robot';
import type { WebSocketStatus } from '../../services/websocket';

const getGatewayBadgeConfig = (status: WebSocketStatus) => {
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

const getRobotStatusBadgeConfig = (status?: RobotStatusType | string) => {
  if (!status) {
    return { label: 'Status unavailable', variant: 'default' as const };
  }

  const capitalized = status.charAt(0).toUpperCase() + status.slice(1);
  switch (status) {
    case 'idle':
    case 'manual':
      return { label: capitalized, variant: 'info' as const };
    case 'navigating':
      return { label: capitalized, variant: 'success' as const };
    case 'error':
      return { label: capitalized, variant: 'danger' as const };
    case 'offline':
    default:
      return { label: capitalized, variant: 'default' as const };
  }
};

const getRobotConnectionBadgeConfig = (status?: RobotConnectionStatus | string) => {
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

export interface RobotStatusProps {
  robot?: Robot | null;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

export const RobotStatus: React.FC<RobotStatusProps> = ({
  robot: propRobot,
  isLoading: propIsLoading,
  error: propError,
  onRetry,
}) => {
  const robotData = useRobotData();
  const robot = propRobot !== undefined ? propRobot : robotData.selectedRobot;
  const isLoading = propIsLoading !== undefined ? propIsLoading : robotData.isLoading;
  const error = propError !== undefined ? propError : robotData.error;
  const handleRetry = onRetry ?? robotData.refetch;

  const { robotState, connectionStatus: wsConnectionStatus } = useRobot();

  const gatewayConfig = getGatewayBadgeConfig(wsConnectionStatus);
  const robotStatusConfig = getRobotStatusBadgeConfig(robot?.status ?? robotState?.status);
  const robotConnConfig = getRobotConnectionBadgeConfig(robot?.connection_status ?? robotState?.connectionStatus);

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
            <StatusBadge status={gatewayConfig.label} variant={gatewayConfig.variant} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Robot link:</span>
            <StatusBadge status={robotConnConfig.label} variant={robotConnConfig.variant} />
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

        {/* Content based on REST state */}
        {isLoading ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-slate-800/80">
            <div className="w-6 h-6 rounded-full border-2 border-slate-700 border-t-sky-400 animate-spin mb-2" />
            <span className="text-xs font-medium text-slate-300">Loading robot metadata...</span>
          </div>
        ) : error ? (
          <div className="py-6 px-4 flex flex-col items-center justify-center text-center bg-rose-500/10 rounded-lg border border-rose-500/20 text-xs">
            <span className="font-semibold text-rose-400">Failed to load robot</span>
            <p className="text-[11px] text-rose-300/80 mt-1 max-w-xs">{error.message}</p>
            {handleRetry && (
              <button
                type="button"
                onClick={handleRetry}
                className="mt-3 px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded text-[11px] font-medium text-slate-200 border border-slate-700"
              >
                Retry
              </button>
            )}
          </div>
        ) : !robot ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            <span className="text-sm font-medium text-slate-300">No robot registered</span>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              No robot found in the fleet registry.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Real Robot Identity & Metadata */}
            <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800 text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 font-medium">Robot Name</span>
                <span className="font-semibold text-slate-200">{robot.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Robot ID</span>
                <span className="font-mono text-slate-300 text-[11px]">{robot.id}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                <span className="text-slate-400">Last seen</span>
                <span className="text-slate-300 font-mono">
                  {robot.last_seen_at ? new Date(robot.last_seen_at).toLocaleString() : 'Never'}
                </span>
              </div>
              {robot.description && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-800/40">
                  {robot.description}
                </div>
              )}
            </div>

            {/* Live Velocities grid (from active telemetry) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Linear Velocity</div>
                <div className="text-base font-semibold text-slate-100">
                  {robotState?.velocity?.linear !== undefined
                    ? robotState.velocity.linear.toFixed(2)
                    : '--'}
                  <span className="text-xs font-normal text-slate-500 ml-1">m/s</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Angular Velocity</div>
                <div className="text-base font-semibold text-slate-100">
                  {robotState?.velocity?.angular !== undefined
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
