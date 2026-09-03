export interface RobotState {
  id?: string;
  name?: string;
  status: 'idle' | 'navigating' | 'manual' | 'offline' | 'error';
  pose?: {
    x: number;
    y: number;
    z: number;
    yaw: number;
  };
  velocity?: {
    linear: number;
    angular: number;
  };
}
