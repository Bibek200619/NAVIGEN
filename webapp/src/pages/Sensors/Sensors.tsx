import React from 'react';
import { CameraStatus } from '../../components/sensors/CameraStatus';
import { IMUStatus } from '../../components/sensors/IMUStatus';
import { OdometryStatus } from '../../components/sensors/OdometryStatus';
import { TFStatus } from '../../components/sensors/TFStatus';
import { JointStateStatus } from '../../components/sensors/JointStateStatus';

export const SensorsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-100">Sensor Interfaces</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <CameraStatus />
        <IMUStatus />
        <OdometryStatus />
        <TFStatus />
        <JointStateStatus />
      </div>
    </div>
  );
};

export default SensorsPage;
