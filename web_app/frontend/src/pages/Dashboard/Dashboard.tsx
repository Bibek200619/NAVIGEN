import React from 'react';
import { LiveMap } from '../../components/dashboard/LiveMap';
import { RobotStatus } from '../../components/dashboard/RobotStatus';
import { TelemetryPanel } from '../../components/dashboard/TelemetryPanel';
import { SensorStatus } from '../../components/dashboard/SensorStatus';
import { CameraPreview } from '../../components/dashboard/CameraPreview';

export const DashboardPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-100">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <LiveMap />
        <RobotStatus />
        <TelemetryPanel />
        <SensorStatus />
        <CameraPreview />
      </div>
    </div>
  );
};

export default DashboardPage;
