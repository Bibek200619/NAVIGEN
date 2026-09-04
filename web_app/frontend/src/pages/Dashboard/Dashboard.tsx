import React from 'react';
import { RefreshCw, Activity, ShieldCheck, Wifi, Radio } from 'lucide-react';
import { LiveMap } from '../../components/dashboard/LiveMap';
import { RobotStatus } from '../../components/dashboard/RobotStatus';
import { TelemetryPanel } from '../../components/dashboard/TelemetryPanel';
import { OperationalStatus } from '../../components/dashboard/OperationalStatus';
import { SensorStatus } from '../../components/dashboard/SensorStatus';
import { CameraPreview } from '../../components/dashboard/CameraPreview';
import { useRobotData } from '../../hooks/useRobotData';
import { useRobot } from '../../hooks/useRobot';
import { useSafetyStatus } from '../../hooks/useSafetyStatus';
import { StatusBadge } from '../../components/common/StatusBadge';

export const DashboardPage: React.FC = () => {
  const {
    selectedRobot,
    selectedRobotId,
    isLoading: robotLoading,
    error: robotError,
    refetch: refetchRobot,
  } = useRobotData();

  const { connectionStatus: wsConnectionStatus } = useRobot();
  const { latestEvent: safetyEvent } = useSafetyStatus(selectedRobotId);

  const getQuickSafetyStatus = () => {
    if (!selectedRobotId || !safetyEvent) {
      return { label: 'SAFETY: UNAVAILABLE', variant: 'default' as const };
    }
    switch (safetyEvent.state) {
      case 'ok':
        return { label: 'SAFETY: NOMINAL', variant: 'success' as const };
      case 'warning':
        return { label: 'SAFETY: WARNING', variant: 'warning' as const };
      case 'emergency_stop':
        return { label: 'SAFETY: EMERGENCY STOP', variant: 'danger' as const };
      default:
        return { label: 'SAFETY: UNKNOWN', variant: 'default' as const };
    }
  };

  const quickSafety = getQuickSafetyStatus();
  const isWsConnected = wsConnectionStatus === 'connected';

  return (
    <div className="space-y-6">
      {/* TOP: Tactical Command HUD Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-900/90 rounded-lg border border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-sky-400" />
              <span>Dashboard</span>
            </h2>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
              UGV Command Station
            </span>
          </div>
          {selectedRobot ? (
            <div className="text-xs font-mono text-slate-400">
              Active Robot: <span className="text-slate-200 font-semibold">{selectedRobot.name}</span>{' '}
              <span className="text-slate-500 font-mono">({selectedRobot.id})</span>
            </div>
          ) : (
            <div className="text-xs text-slate-500 font-mono">
              Fleet Status: No active robot selected
            </div>
          )}
        </div>

        {/* Tactical Quick-Scan Indicators */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Gateway link pill */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs">
            <Wifi className={`w-3.5 h-3.5 ${isWsConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-slate-400 text-[11px] font-mono">Gateway</span>
            <span
              className={`w-2 h-2 rounded-full ${
                isWsConnected ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
          </div>

          {/* Operational State Pill */}
          {selectedRobot && (
            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-950/80 rounded border border-slate-800 text-xs">
              <Radio className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-slate-400 text-[11px] font-mono">Mode</span>
              <span className="font-mono text-[11px] text-slate-200 uppercase font-semibold">
                {selectedRobot.status}
              </span>
            </div>
          )}

          {/* Safety State Pill */}
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-slate-400" />
            <StatusBadge status={quickSafety.label} variant={quickSafety.variant} />
          </div>

          {/* Sync Button */}
          <button
            type="button"
            onClick={() => refetchRobot()}
            title="Sync Robot Fleet State"
            aria-label="Refresh Robot State"
            className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* MAIN: Tactical Situational Awareness (Map, Camera, Robot Vehicle Status) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-12 xl:col-span-5">
          <LiveMap />
        </div>
        <div className="lg:col-span-6 xl:col-span-4">
          <CameraPreview />
        </div>
        <div className="lg:col-span-6 xl:col-span-3">
          <RobotStatus
            robot={selectedRobot}
            isLoading={robotLoading}
            error={robotError}
            onRetry={refetchRobot}
          />
        </div>
      </div>

      {/* LOWER: Telemetry & Drive, Operational Diagnostics & SLAM, Sensor Health Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        <TelemetryPanel robotId={selectedRobotId} />
        <OperationalStatus robotId={selectedRobotId} />
        <SensorStatus robotId={selectedRobotId} className="md:col-span-2 xl:col-span-1" />
      </div>
    </div>
  );
};

export default DashboardPage;
