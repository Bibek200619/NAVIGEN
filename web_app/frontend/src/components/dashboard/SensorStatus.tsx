import React from 'react';
import { Panel } from '../common/Panel';
import { StatusBadge } from '../common/StatusBadge';
import { ROS_TOPICS } from '../../constants/topics';
import type { SensorStatusResponse } from '../../types/api';
import { useSensorStatus } from '../../hooks/useSensorStatus';
import { matchSensor, KNOWN_SENSOR_TARGETS } from '../../utils/sensorMatcher';

export interface SensorStatusProps {
  robotId?: string | null;
  sensors?: SensorStatusResponse[];
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
}

interface CoreSensorConfig {
  name: string;
  defaultTopic: string;
  target: typeof KNOWN_SENSOR_TARGETS[keyof typeof KNOWN_SENSOR_TARGETS];
}

const CORE_SENSORS: CoreSensorConfig[] = [
  { name: 'Camera', defaultTopic: ROS_TOPICS.CAMERA_IMAGE_RAW, target: KNOWN_SENSOR_TARGETS.CAMERA },
  { name: 'IMU', defaultTopic: ROS_TOPICS.IMU_DATA, target: KNOWN_SENSOR_TARGETS.IMU },
  { name: 'Odometry', defaultTopic: ROS_TOPICS.WHEEL_ODOM, target: KNOWN_SENSOR_TARGETS.ODOMETRY },
  { name: 'TF', defaultTopic: ROS_TOPICS.TF, target: KNOWN_SENSOR_TARGETS.TF },
  { name: 'Joint States', defaultTopic: ROS_TOPICS.JOINT_STATES, target: KNOWN_SENSOR_TARGETS.JOINT_STATES },
];

export const SensorStatus: React.FC<SensorStatusProps> = ({
  robotId,
  sensors: propsSensors,
  isLoading: propsLoading,
  error: propsError,
  onRetry,
}) => {
  // Use hook if props not explicitly provided
  const hookResult = useSensorStatus(robotId, { enabled: propsSensors === undefined });
  const sensors = propsSensors ?? hookResult.sensors;
  const isLoading = propsLoading ?? hookResult.isLoading;
  const error = propsError ?? hookResult.error;
  const handleRetry = onRetry ?? hookResult.refetch;

  // Match each core sensor truthfully from backend data
  const matchedList = CORE_SENSORS.map((item) => {
    const matched = matchSensor(sensors, item.target);
    const topic = matched?.topic ?? item.defaultTopic;
    let statusText = 'UNAVAILABLE';
    let variant: 'success' | 'danger' | 'default' = 'default';

    if (matched) {
      if (matched.is_active === true) {
        statusText = 'ACTIVE';
        variant = 'success';
      } else {
        statusText = 'INACTIVE';
        variant = 'danger';
      }
    }

    return {
      ...item,
      topic,
      matched,
      statusText,
      variant,
      isActive: matched?.is_active === true,
      frequencyHz: matched?.frequency_hz,
    };
  });

  // Calculate reporting count strictly from real matched sensors
  const activeCount = matchedList.filter((m) => m.isActive).length;
  const reportingAggregate = !robotId
    ? '-- / 5 reporting'
    : isLoading
      ? 'Loading...'
      : error
        ? 'Error'
        : `${activeCount} / 5 reporting`;

  return (
    <Panel className="relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-300">Sensor Health</h3>
        <span
          className="text-xs font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/50"
          data-testid="sensor-health-aggregate"
        >
          {reportingAggregate}
        </span>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-xs text-slate-400" data-testid="sensor-loading">
          Loading sensor health...
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-md text-xs text-rose-400 space-y-2">
          <div>Failed to load sensor status: {error.message}</div>
          {handleRetry && (
            <button
              onClick={() => handleRetry()}
              className="px-2 py-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 rounded text-xs transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {matchedList.map((sensor) => (
            <div
              key={sensor.name}
              className="flex items-center justify-between p-2.5 bg-slate-950/60 rounded-md border border-slate-800 text-xs"
            >
              <div className="flex flex-col min-w-0 pr-2">
                <div className="flex items-center space-x-1.5">
                  <span className="font-medium text-slate-200 truncate">{sensor.name}</span>
                  {sensor.frequencyHz != null && (
                    <span className="text-[10px] font-mono text-slate-400">
                      ({sensor.frequencyHz} Hz)
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-slate-500 truncate" title={sensor.topic}>
                  {sensor.topic}
                </span>
              </div>
              <StatusBadge status={sensor.statusText} variant={sensor.variant} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
};
