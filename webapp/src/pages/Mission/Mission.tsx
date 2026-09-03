import React from 'react';
import { MissionStatus } from '../../components/mission/MissionStatus';
import { MissionControls } from '../../components/mission/MissionControls';
import { MissionHistory } from '../../components/mission/MissionHistory';

export const MissionPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-100">Mission Management</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <MissionStatus />
        <MissionControls />
        <div className="md:col-span-2">
          <MissionHistory />
        </div>
      </div>
    </div>
  );
};

export default MissionPage;
