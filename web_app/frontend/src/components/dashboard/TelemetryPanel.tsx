import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { useTelemetry } from '../../hooks/useTelemetry';
import type { WebSocketStatus } from '../../services/websocket';

const getStatusBadgeConfig = (status: WebSocketStatus) => {
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

export const TelemetryPanel: React.FC = () => {
  const { telemetry, status } = useTelemetry();
  const statusConfig = getStatusBadgeConfig(status);

  const streamBadge = !telemetry
    ? { label: 'Unavailable', variant: 'default' as const }
    : telemetry.isStale
    ? { label: 'Stale', variant: 'warning' as const }
    : { label: 'Live', variant: 'success' as const };

  return (
    <Panel title="Telemetry">
      <div className="space-y-4">
        {/* Status header row */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Connection:</span>
            <StatusBadge status={statusConfig.label} variant={statusConfig.variant} />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Stream:</span>
            <StatusBadge status={streamBadge.label} variant={streamBadge.variant} />
          </div>
        </div>

        {/* Main telemetry content */}
        {telemetry === null ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            <span className="text-sm font-medium text-slate-300">No telemetry data</span>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {status === 'connected'
                ? 'Connected to gateway. Waiting for incoming telemetry packets...'
                : status === 'connecting'
                ? 'Connecting to WebSocket service...'
                : status === 'reconnecting'
                ? 'Connection lost. Attempting to reconnect...'
                : 'WebSocket disconnected. Telemetry unavailable.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Battery Level */}
            <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-slate-400">Battery Level</span>
                <span className="font-semibold text-slate-200">
                  {telemetry.batteryLevel !== undefined
                    ? `${telemetry.batteryLevel.toFixed(1)}%`
                    : '--'}
                </span>
              </div>
              {telemetry.batteryLevel !== undefined && (
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      telemetry.batteryLevel > 50
                        ? 'bg-emerald-500'
                        : telemetry.batteryLevel > 20
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{
                      width: `${Math.max(0, Math.min(100, telemetry.batteryLevel))}%`,
                    }}
                  />
                </div>
              )}
            </div>

            {/* Velocities grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Linear Velocity</div>
                <div className="text-base font-semibold text-slate-100">
                  {telemetry.linearVelocity !== undefined
                    ? telemetry.linearVelocity.toFixed(2)
                    : '--'}
                  <span className="text-xs font-normal text-slate-500 ml-1">m/s</span>
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-xs text-slate-400 mb-1">Angular Velocity</div>
                <div className="text-base font-semibold text-slate-100">
                  {telemetry.angularVelocity !== undefined
                    ? telemetry.angularVelocity.toFixed(2)
                    : '--'}
                  <span className="text-xs font-normal text-slate-500 ml-1">rad/s</span>
                </div>
              </div>
            </div>

            {/* Last updated timestamp */}
            {telemetry.timestamp ? (
              <div className="text-[11px] text-slate-500 text-right">
                Last packet: {new Date(telemetry.timestamp).toLocaleTimeString()}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
};
