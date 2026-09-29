import React from 'react';
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
  className?: string;
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
  className = '',
}) => {
  const hookResult = useSensorStatus(robotId, { enabled: propsSensors === undefined });
  const sensors = propsSensors ?? hookResult.sensors;
  const isLoading = propsLoading ?? hookResult.isLoading;
  const error = propsError ?? hookResult.error;
  const handleRetry = onRetry ?? hookResult.refetch;

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

  const activeCount = matchedList.filter((m) => m.isActive).length;
  const reportingAggregate = !robotId
    ? '-- / 5 reporting'
    : isLoading
      ? 'Loading...'
      : error
        ? 'Error'
        : `${activeCount} / 5 reporting`;

  return (
    <section className={`telemetry-summary ${className}`}>
      <header className="section-heading">
        <h2>Sensor health</h2>
        <span className="eyebrow" data-testid="sensor-health-aggregate">
          {reportingAggregate}
        </span>
      </header>

      {isLoading ? (
        <p className="dashboard-loading" data-testid="sensor-loading">
          Loading sensor health...
        </p>
      ) : error ? (
        <div className="dashboard-error">
          <strong>Failed to load sensor status</strong>
          <span>{error.message}</span>
          {handleRetry && (
            <button type="button" className="button" onClick={() => handleRetry()}>
              Retry
            </button>
          )}
        </div>
      ) : (
        <div className="sensor-list">
          {matchedList.map((sensor) => (
            <div key={sensor.name} className="sensor-row">
              <div>
                <strong>
                  {sensor.name}
                  {sensor.frequencyHz != null ? ` (${sensor.frequencyHz} Hz)` : ''}
                </strong>
                <small title={sensor.topic}>{sensor.topic}</small>
              </div>
              <StatusBadge status={sensor.statusText} variant={sensor.variant} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
