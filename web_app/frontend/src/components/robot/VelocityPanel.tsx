import React from 'react';
import { Gauge, Activity } from 'lucide-react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { useTelemetry } from '../../hooks/useTelemetry';

export const VelocityPanel: React.FC = () => {
  const { telemetry, status } = useTelemetry();

  const streamBadge = !telemetry
    ? { label: 'Unavailable', variant: 'default' as const }
    : telemetry.isStale
    ? { label: 'Stale', variant: 'warning' as const }
    : { label: 'Live', variant: 'success' as const };

  return (
    <Panel title="Velocity">
      <div className="space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-mono text-[11px]">Stream Status:</span>
          </div>
          <StatusBadge status={streamBadge.label} variant={streamBadge.variant} />
        </div>

        {/* Content */}
        {!telemetry ? (
          <div className="py-8 px-4 flex flex-col items-center justify-center text-center bg-slate-950/40 rounded-lg border border-dashed border-slate-800">
            <Gauge className="w-8 h-8 text-slate-600 mb-2" />
            <span className="text-sm font-medium text-slate-300">No velocity telemetry</span>
            <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
              {status === 'connected'
                ? 'Connected to gateway. Waiting for incoming velocity telemetry...'
                : status === 'connecting'
                ? 'Connecting to gateway service...'
                : status === 'reconnecting'
                ? 'Connection lost. Attempting to reconnect...'
                : 'Gateway is offline. Velocity telemetry unavailable.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Linear Velocity Card */}
              <div className="p-3.5 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Linear Velocity
                </div>
                <div className="text-lg font-bold font-mono text-slate-100 flex items-baseline">
                  <span>
                    {telemetry.linearVelocity !== undefined
                      ? telemetry.linearVelocity.toFixed(2)
                      : '--'}
                  </span>
                  <span className="text-xs font-normal font-sans text-slate-500 ml-1.5">m/s</span>
                </div>
              </div>

              {/* Angular Velocity Card */}
              <div className="p-3.5 bg-slate-950/60 rounded-md border border-slate-800">
                <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                  Angular Velocity
                </div>
                <div className="text-lg font-bold font-mono text-slate-100 flex items-baseline">
                  <span>
                    {telemetry.angularVelocity !== undefined
                      ? telemetry.angularVelocity.toFixed(2)
                      : '--'}
                  </span>
                  <span className="text-xs font-normal font-sans text-slate-500 ml-1.5">rad/s</span>
                </div>
              </div>
            </div>

            {telemetry.timestamp ? (
              <div className="text-[11px] font-mono text-slate-500 text-right">
                Last packet: {new Date(telemetry.timestamp).toLocaleTimeString()}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
};
