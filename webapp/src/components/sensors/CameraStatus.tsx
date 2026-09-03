import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { ROS_TOPICS } from '../../constants/topics';

export const CameraStatus: React.FC = () => {
  return (
    <Panel title="Camera Sensor">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400">{ROS_TOPICS.CAMERA_IMAGE_RAW}</span>
        <StatusBadge status="Active" variant="success" />
      </div>
    </Panel>
  );
};
