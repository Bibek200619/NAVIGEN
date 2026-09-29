import React from 'react';
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
  className?: string;
}

export const RobotStatus: React.FC<RobotStatusProps> = ({
  robot: propRobot,
  isLoading: propIsLoading,
  error: propError,
  onRetry,
  className = '',
}) => {
  const robotData = useRobotData();
  const robot = propRobot !== undefined ? propRobot : robotData.selectedRobot;
  const isLoading = propIsLoading !== undefined ? propIsLoading : robotData.isLoading;
  const error = propError !== undefined ? propError : robotData.error;
  const handleRetry = onRetry ?? robotData.refetch;

  const { robotState, connectionStatus: wsConnectionStatus } = useRobot();

  const gatewayConfig = getGatewayBadgeConfig(wsConnectionStatus);
  const robotStatusConfig = getRobotStatusBadgeConfig(robot?.status ?? robotState?.status);
  const robotConnConfig = getRobotConnectionBadgeConfig(
    robot?.connection_status ?? robotState?.connectionStatus,
  );

  const telemetryConfig =
    robotState === null || robotState.isStale === undefined
      ? { label: 'Unavailable', variant: 'default' as const }
      : robotState.isStale
        ? { label: 'Stale', variant: 'warning' as const }
        : { label: 'Live', variant: 'success' as const };

  return (
    <section className={`telemetry-summary ${className}`}>
      <header className="section-heading">
        <h2>Robot Status</h2>
        <span className="eyebrow">02</span>
      </header>

      <dl className="detail-list">
        <div>
          <dt>Gateway</dt>
          <dd>
            <StatusBadge status={gatewayConfig.label} variant={gatewayConfig.variant} />
          </dd>
        </div>
        <div>
          <dt>Robot link</dt>
          <dd>
            <StatusBadge status={robotConnConfig.label} variant={robotConnConfig.variant} />
          </dd>
        </div>
        <div>
          <dt>Robot status</dt>
          <dd>
            <StatusBadge status={robotStatusConfig.label} variant={robotStatusConfig.variant} />
          </dd>
        </div>
        <div>
          <dt>Telemetry</dt>
          <dd>
            <StatusBadge status={telemetryConfig.label} variant={telemetryConfig.variant} />
          </dd>
        </div>
      </dl>

      {isLoading ? (
        <p className="dashboard-loading">Loading robot metadata...</p>
      ) : error ? (
        <div className="dashboard-error" role="alert">
          <strong>Failed to load robot</strong>
          <span>{error.message}</span>
          {handleRetry && (
            <button type="button" className="button" onClick={handleRetry}>
              Retry
            </button>
          )}
        </div>
      ) : !robot ? (
        <p className="dashboard-note">No robot registered</p>
      ) : (
        <>
          <dl className="detail-list">
            <div>
              <dt>Robot name</dt>
              <dd>{robot.name}</dd>
            </div>
            <div>
              <dt>Robot ID</dt>
              <dd className="mono">{robot.id}</dd>
            </div>
            <div>
              <dt>Last seen</dt>
              <dd className="mono">
                {robot.last_seen_at ? new Date(robot.last_seen_at).toLocaleString() : 'Never'}
              </dd>
            </div>
            <div>
              <dt>Linear velocity</dt>
              <dd>
                {robotState?.velocity?.linear !== undefined
                  ? `${robotState.velocity.linear.toFixed(2)} m/s`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt>Angular velocity</dt>
              <dd>
                {robotState?.velocity?.angular !== undefined
                  ? `${robotState.velocity.angular.toFixed(2)} rad/s`
                  : '—'}
              </dd>
            </div>
          </dl>
          {robot.description && <p className="dashboard-note">{robot.description}</p>}
        </>
      )}
    </section>
  );
};
