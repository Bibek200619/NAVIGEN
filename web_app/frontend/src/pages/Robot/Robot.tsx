import React from 'react';
import { RobotOverview } from '../../components/robot/RobotOverview';
import { PosePanel } from '../../components/robot/PosePanel';
import { VelocityPanel } from '../../components/robot/VelocityPanel';
import { TFTree } from '../../components/robot/TFTree';

export const RobotPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-100">Robot Status & Configuration</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RobotOverview />
        <PosePanel />
        <VelocityPanel />
        <TFTree />
      </div>
    </div>
  );
};

export default RobotPage;
