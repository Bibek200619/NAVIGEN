import React from 'react';
import { LiveMap } from '../../components/dashboard/LiveMap';
import { RobotStatus } from '../../components/dashboard/RobotStatus';
import { TelemetryPanel } from '../../components/dashboard/TelemetryPanel';
import { OperationalStatus } from '../../components/dashboard/OperationalStatus';
import { SensorStatus } from '../../components/dashboard/SensorStatus';
import { CameraPreview } from '../../components/dashboard/CameraPreview';
import { useRobotData } from '../../hooks/useRobotData';

export const DashboardPage: React.FC = () => {
  const {
    selectedRobot,
    selectedRobotId,
    isLoading: robotLoading,
    error: robotError,
    refetch: refetchRobot,
  } = useRobotData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-100">Dashboard</h2>
        {selectedRobot && (
          <div className="text-xs font-mono text-slate-400">
            Active Robot: <span className="text-slate-200 font-semibold">{selectedRobot.name}</span> ({selectedRobot.id})
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <LiveMap />
        <RobotStatus
          robot={selectedRobot}
          isLoading={robotLoading}
          error={robotError}
          onRetry={refetchRobot}
        />
        <TelemetryPanel robotId={selectedRobotId} />
        <OperationalStatus robotId={selectedRobotId} />
        <SensorStatus robotId={selectedRobotId} />
        <CameraPreview />
      </div>
    </div>
  );
};

export default DashboardPage;
