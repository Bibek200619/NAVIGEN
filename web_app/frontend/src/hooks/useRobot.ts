import { useState } from 'react';
import type { RobotConnectionStatus, RobotState } from '../types/robot';
import { useWebSocket } from './useWebSocket';
import type { WebSocketStatus } from '../services/websocket';

/**
 * Canonical v1 robot telemetry payload schema from WebSocket envelopes.
 */
interface RobotTelemetryPayload {
  connection_status?: RobotConnectionStatus;
  linear_velocity?: number;
  angular_velocity?: number;
  battery_level_pct?: number;
  is_stale?: boolean;
}

export interface UseRobotReturn {
  robotState: RobotState | null;
  connectionStatus: WebSocketStatus;
  isConnected: boolean;
}

/**
 * Hook providing live UGV robot state derived from WebSocket telemetry.
 */
export const useRobot = (): UseRobotReturn => {
  const { isConnected, status: connectionStatus, latestMessage } = useWebSocket<RobotTelemetryPayload>();
  const [prevMessage, setPrevMessage] = useState(latestMessage);
  const [robotState, setRobotState] = useState<RobotState | null>(null);

  if (latestMessage !== prevMessage) {
    setPrevMessage(latestMessage);
    if (latestMessage && latestMessage.event_type === 'robot.telemetry' && latestMessage.payload) {
      const payload = latestMessage.payload;

      setRobotState({
        id: latestMessage.robot_id,
        connectionStatus: payload.connection_status,
        isStale: payload.is_stale,
        velocity:
          payload.linear_velocity !== undefined || payload.angular_velocity !== undefined
            ? {
                linear: payload.linear_velocity,
                angular: payload.angular_velocity,
              }
            : undefined,
      });
    }
  }

  return {
    robotState,
    connectionStatus,
    isConnected,
  };
};
