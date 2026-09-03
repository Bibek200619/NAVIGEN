export type RobotStatus = 'idle' | 'navigating' | 'manual' | 'offline' | 'error';
export type RobotConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export interface RobotState {
  id?: string;
  name?: string;
  status?: RobotStatus;
  connectionStatus?: RobotConnectionStatus;
  isStale?: boolean;
  pose?: {
    x: number;
    y: number;
    z: number;
    yaw: number;
  };
  velocity?: {
    linear?: number;
    angular?: number;
  };
}
