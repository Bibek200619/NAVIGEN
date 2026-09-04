import type { SensorStatusResponse } from '../types/api';
import { ROS_TOPICS } from '../constants/topics';

export interface SensorMatcherTarget {
  keyPatterns: readonly string[];
  topicPattern?: string;
  nameSubstrings?: readonly string[];
}

export const KNOWN_SENSOR_TARGETS = {
  CAMERA: {
    keyPatterns: ['camera', 'camera_sensor', 'cam', 'camera_image', 'cam_sensor'],
    topicPattern: ROS_TOPICS.CAMERA_IMAGE_RAW,
    nameSubstrings: ['camera'],
  },
  IMU: {
    keyPatterns: ['imu', 'imu_sensor', 'imu_data'],
    topicPattern: ROS_TOPICS.IMU_DATA,
    nameSubstrings: ['imu'],
  },
  ODOMETRY: {
    keyPatterns: ['wheel_odom', 'wheel_odometry', 'odometry', 'odom'],
    topicPattern: ROS_TOPICS.WHEEL_ODOM,
    nameSubstrings: ['odom', 'odometry'],
  },
  TF: {
    keyPatterns: ['tf', 'tf_static', 'transform', 'transforms'],
    topicPattern: ROS_TOPICS.TF,
    nameSubstrings: ['tf', 'transform'],
  },
  JOINT_STATES: {
    keyPatterns: ['joint_states', 'joint_state', 'joints', 'joint'],
    topicPattern: ROS_TOPICS.JOINT_STATES,
    nameSubstrings: ['joint'],
  },
} as const;

/**
 * Matches a sensor from the backend collection against target criteria.
 * Order of precedence:
 * 1. sensor_key match (case-insensitive)
 * 2. topic match
 * 3. name substring match (case-insensitive)
 */
export const matchSensor = (
  sensors: SensorStatusResponse[] | null | undefined,
  target: SensorMatcherTarget,
): SensorStatusResponse | undefined => {
  if (!sensors || sensors.length === 0) {
    return undefined;
  }

  const normalizedKeyPatterns = target.keyPatterns.map((k) => k.toLowerCase());

  // 1. Try matching sensor_key
  const byKey = sensors.find((s) =>
    s.sensor_key && normalizedKeyPatterns.includes(s.sensor_key.toLowerCase()),
  );
  if (byKey) return byKey;

  // 2. Try matching topic
  if (target.topicPattern) {
    const byTopic = sensors.find(
      (s) => s.topic && s.topic.trim() === target.topicPattern?.trim(),
    );
    if (byTopic) return byTopic;
  }

  // 3. Try matching name substring
  if (target.nameSubstrings && target.nameSubstrings.length > 0) {
    const byName = sensors.find((s) => {
      if (!s.name) return false;
      const lowerName = s.name.toLowerCase();
      return target.nameSubstrings!.some((sub) => lowerName.includes(sub.toLowerCase()));
    });
    if (byName) return byName;
  }

  return undefined;
};

/**
 * Returns badge status and styling for a sensor.
 * Never claims 'Active' unless sensor is present and is_active is strictly true.
 */
export const getSensorBadgeInfo = (
  sensor?: SensorStatusResponse | null,
): {
  status: 'Active' | 'Inactive' | 'Unavailable';
  variant: 'success' | 'danger' | 'default';
  isActive: boolean;
} => {
  if (!sensor) {
    return { status: 'Unavailable', variant: 'default', isActive: false };
  }
  if (sensor.is_active === true) {
    return { status: 'Active', variant: 'success', isActive: true };
  }
  return { status: 'Inactive', variant: 'danger', isActive: false };
};

/**
 * Formats a timestamp without inventing data.
 */
export const formatSensorTimestamp = (timestamp?: string | null): string => {
  if (!timestamp) return 'No data';
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleTimeString();
  } catch {
    return timestamp;
  }
};
