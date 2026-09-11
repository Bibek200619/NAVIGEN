import React from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowUpRight } from 'lucide-react';
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
      <header className="dashboard-strip">
        <div>
          <h2>Dashboard</h2>
          {selectedRobot ? (
            <p className="fleet-meta">
              Active robot: <strong>{selectedRobot.name}</strong>{' '}
              <span className="mono">({selectedRobot.id})</span>
            </p>
          ) : (
            <p className="fleet-meta">Fleet status: No active robot selected</p>
          )}
        </div>

        <div className="dashboard-pills">
          <span className="dashboard-pill">
            Gateway
            <StatusBadge
              status={isWsConnected ? 'Connected' : 'Offline'}
              variant={isWsConnected ? 'success' : 'default'}
            />
          </span>
          {selectedRobot && (
            <span className="dashboard-pill">
              Mode
              <strong>{selectedRobot.status}</strong>
            </span>
          )}
          <StatusBadge status={quickSafety.label} variant={quickSafety.variant} />
          <button
            type="button"
            onClick={() => refetchRobot()}
            title="Sync robot fleet state"
            aria-label="Refresh Robot State"
            className="icon-button"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="dashboard-card">
          <LiveMap />
        </div>
        <div className="dashboard-card">
          <CameraPreview compact />
        </div>
        <div className="dashboard-card">
          <RobotStatus
            robot={selectedRobot}
            isLoading={robotLoading}
            error={robotError}
            onRetry={refetchRobot}
          />
        </div>
      </div>

      <div className="dashboard-grid-lower">
        <TelemetryPanel robotId={selectedRobotId} />
        <OperationalStatus robotId={selectedRobotId} />
        <SensorStatus robotId={selectedRobotId} />
      </div>

      <section className="overview-bottom">
        <p>
          <span className="eyebrow">AT A GLANCE</span>Video and vehicle
          telemetry connect independently.
        </p>
        <Link to="/sensors" className="text-link">
          Inspect sensors <ArrowUpRight size={15} />
        </Link>
      </section>
    </div>
  );
};
