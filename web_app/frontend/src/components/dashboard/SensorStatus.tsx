import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { ROS_TOPICS } from '../../constants/topics';

interface SensorItem {
  name: string;
  topic: string;
}

const SENSORS: SensorItem[] = [
  { name: 'Camera', topic: ROS_TOPICS.CAMERA_IMAGE_RAW },
  { name: 'IMU', topic: ROS_TOPICS.IMU_DATA },
  { name: 'Wheel Odometry', topic: ROS_TOPICS.WHEEL_ODOM },
  { name: 'TF', topic: ROS_TOPICS.TF },
  { name: 'Joint States', topic: ROS_TOPICS.JOINT_STATES },
];

export const SensorStatus: React.FC = () => {
  return (
    <Panel title="Sensors">
      <div className="space-y-2">
        {SENSORS.map((sensor) => (
          <div
            key={sensor.topic}
            className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-md border border-slate-800 text-xs"
          >
            <div className="flex flex-col min-w-0 pr-2">
              <span className="font-medium text-slate-200 truncate">{sensor.name}</span>
              <span className="font-mono text-[11px] text-slate-500 truncate">{sensor.topic}</span>
            </div>
            <StatusBadge status="Unavailable" variant="default" />
          </div>
        ))}
      </div>
    </Panel>
  );
};
