import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { useTelemetry } from '../../hooks/useTelemetry';
import { useTelemetryHistory } from '../../hooks/useTelemetryHistory';
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

export interface TelemetryPanelProps {
  robotId?: string | null;
  className?: string;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ robotId, className = '' }) => {
  const { telemetry, status } = useTelemetry();
  const {
    history,
    isLoading: historyLoading,
    error: historyError,
  } = useTelemetryHistory(robotId, { limit: 5 });

  const statusConfig = getStatusBadgeConfig(status);

  const streamBadge = !telemetry
    ? { label: 'Unavailable', variant: 'default' as const }
    : telemetry.isStale
    ? { label: 'Stale', variant: 'warning' as const }
    : { label: 'Live', variant: 'success' as const };

  // Position coordinates: check live telemetry first, fallback to latest sample if live is null
  const posX = telemetry?.positionX ?? telemetry?.position?.x ?? telemetry?.position_x ?? history[0]?.position_x ?? null;
  const posY = telemetry?.positionY ?? telemetry?.position?.y ?? telemetry?.position_y ?? history[0]?.position_y ?? null;
  const posZ = telemetry?.positionZ ?? telemetry?.position?.z ?? telemetry?.position_z ?? history[0]?.position_z ?? null;
  const yaw = telemetry?.yaw ?? history[0]?.yaw ?? null;

  return (
    <Panel title="Telemetry" className={className}>
      <div className="space-y-4">
        {/* Status header row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center justify-between py-1 px-2.5 bg-slate-950/60 rounded border border-slate-800/80">
            <span className="text-slate-400">Connection:</span>
            <StatusBadge status={statusConfig.label} variant={statusConfig.variant} />
          </div>
          <div className="flex items-center justify-between py-1 px-2.5 bg-slate-950/60 rounded border border-slate-800/80">
            <span className="text-slate-400">Stream:</span>
            <StatusBadge status={streamBadge.label} variant={streamBadge.variant} />
          </div>
        </div>

        {/* 1. LIVE TELEMETRY */}
        <div>
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Live Telemetry
          </h4>
          {telemetry === null ? (
            <div className="py-4 px-3 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
              <span className="text-xs font-medium text-slate-300">No telemetry data</span>
              <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">
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
            <div className="space-y-2.5">
              {/* Battery Level */}
              <div className="p-2.5 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="flex items-center justify-between text-xs mb-1">
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
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 bg-slate-950/60 rounded-md border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-0.5">Linear Velocity</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">
                    {telemetry.linearVelocity !== undefined
                      ? telemetry.linearVelocity.toFixed(2)
                      : '--'}
                    <span className="text-xs font-normal text-slate-500 ml-1">m/s</span>
                  </div>
                </div>

                <div className="p-2.5 bg-slate-950/60 rounded-md border border-slate-800">
                  <div className="text-[11px] text-slate-400 mb-0.5">Angular Velocity</div>
                  <div className="text-sm font-semibold text-slate-100 font-mono">
                    {telemetry.angularVelocity !== undefined
                      ? telemetry.angularVelocity.toFixed(2)
                      : '--'}
                    <span className="text-xs font-normal text-slate-500 ml-1">rad/s</span>
                  </div>
                </div>
              </div>

              {/* Last updated timestamp / stale age */}
              <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                <span>
                  {telemetry.dataAgeMs !== undefined
                    ? `Age: ${telemetry.dataAgeMs} ms`
                    : telemetry.isStale
                    ? 'State: Stale'
                    : 'State: Fresh'}
                </span>
                <span>
                  {telemetry.timestamp
                    ? `Last packet: ${new Date(telemetry.timestamp).toLocaleTimeString()}`
                    : null}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 2. POSITION */}
        <div className="pt-2 border-t border-slate-800/80">
          <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Position
          </h4>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="p-2 bg-slate-950/60 rounded border border-slate-800/90 text-center">
              <span className="text-[10px] text-slate-400 block font-mono">X</span>
              <span className="font-mono text-slate-200 font-semibold">
                {posX !== null ? `${posX.toFixed(2)}m` : '--'}
              </span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded border border-slate-800/90 text-center">
              <span className="text-[10px] text-slate-400 block font-mono">Y</span>
              <span className="font-mono text-slate-200 font-semibold">
                {posY !== null ? `${posY.toFixed(2)}m` : '--'}
              </span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded border border-slate-800/90 text-center">
              <span className="text-[10px] text-slate-400 block font-mono">Z</span>
              <span className="font-mono text-slate-200 font-semibold">
                {posZ !== null ? `${posZ.toFixed(2)}m` : '--'}
              </span>
            </div>
            <div className="p-2 bg-slate-950/60 rounded border border-slate-800/90 text-center">
              <span className="text-[10px] text-slate-400 block font-mono">Yaw</span>
              <span className="font-mono text-slate-200 font-semibold">
                {yaw !== null ? `${yaw.toFixed(2)}` : '--'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. TELEMETRY HISTORY */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Telemetry History
            </h4>
            {history.length > 0 && (
              <span className="text-[10px] text-slate-500 font-mono">
                {history.length} sample{history.length === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {historyLoading ? (
            <div className="py-3 text-center text-xs text-slate-500">
              Loading telemetry history...
            </div>
          ) : historyError ? (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded text-xs text-rose-400">
              History unavailable: {historyError.message}
            </div>
          ) : history.length === 0 ? (
            <div className="py-3 text-center text-xs text-slate-500">
              No telemetry history available
            </div>
          ) : (
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {history.map((sample, idx) => (
                <div
                  key={sample.id ?? `${sample.recorded_at}-${idx}`}
                  className="flex items-center justify-between p-1.5 bg-slate-950/60 rounded border border-slate-800/80 text-[11px] font-mono"
                >
                  <span className="text-slate-400">
                    {new Date(sample.recorded_at).toLocaleTimeString()}
                  </span>
                  <span className="text-slate-300">
                    {sample.linear_velocity !== null
                      ? `${sample.linear_velocity.toFixed(2)} m/s`
                      : '--'}
                  </span>
                  <span className="text-slate-300">
                    {sample.battery_level_pct !== null
                      ? `${sample.battery_level_pct.toFixed(0)}%`
                      : '--'}
                  </span>
                  <span className="text-slate-500 capitalize text-[10px]">
                    {sample.connection_status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
};
