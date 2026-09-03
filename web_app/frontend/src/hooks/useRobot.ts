import { useState } from 'react';
import type { RobotState } from '../types/robot';

const initialRobotState: RobotState = {
  id: 'navigen-ugv-01',
  name: 'NAVIGEN UGV',
  status: 'idle',
  pose: { x: 0, y: 0, z: 0, yaw: 0 },
  velocity: { linear: 0, angular: 0 },
};

/**
 * Placeholder hook for robot status and commands.
 */
export const useRobot = () => {
  const [robotState] = useState<RobotState>(initialRobotState);

  return {
    robotState,
  };
};
