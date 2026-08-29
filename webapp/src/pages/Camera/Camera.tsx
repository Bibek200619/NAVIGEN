import React from 'react';
import { CameraViewer } from '../../components/camera/CameraViewer';

export const CameraPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-100">Camera Feed</h2>
      <div className="max-w-4xl">
        <CameraViewer />
      </div>
    </div>
  );
};

export default CameraPage;
