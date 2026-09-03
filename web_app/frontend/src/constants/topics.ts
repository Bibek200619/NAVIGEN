/**
 * Confirmed ROS 2 topics for NAVIGEN UGV interface
 * Note: LiDAR and GPS are explicitly omitted as per NAVIGEN specifications.
 */
export const ROS_TOPICS = {
  WHEEL_ODOM: '/wheel/odom',
  IMU_DATA: '/imu/data',
  CAMERA_IMAGE_RAW: '/camera/image_raw',
  TF: '/tf',
  JOINT_STATES: '/joint_states',
  CMD_VEL: '/cmd_vel',
} as const;

export type RosTopic = typeof ROS_TOPICS[keyof typeof ROS_TOPICS];
