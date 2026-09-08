import { useState } from 'react';
import { useNow } from './useNow';
import type { TelemetryData } from '../types/telemetry';
import { useWebSocket } from './useWebSocket';
import type { WebSocketStatus } from '../services/websocket';

/**
 * Canonical v1 robot telemetry payload schema from WebSocket envelopes.
 */
interface RobotTelemetryPayload {
  connection_status?: 'connected' | 'disconnected' | 'connecting';
  linear_velocity?: number;
  angular_velocity?: number;
  battery_level_pct?: number;
  is_stale?: boolean;
  position_x?: number;
  position_y?: number;
  position_z?: number;
  yaw?: number;
  safety_state?: 'ok' | 'warning' | 'emergency_stop';
}

export interface UseTelemetryReturn {
  telemetry: TelemetryData | null;
  isConnected: boolean;
  status: WebSocketStatus;
}

/**
 * Hook providing live UGV telemetry stream via WebSocket.
 */
export const useTelemetry = (): UseTelemetryReturn => {
  const now = useNow();
  const { isConnected, status, latestMessage } =
    useWebSocket<RobotTelemetryPayload>();
  const [prevMessage, setPrevMessage] = useState(latestMessage);
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

  if (latestMessage !== prevMessage) {
    setPrevMessage(latestMessage);
    if (
      latestMessage &&
      latestMessage.event_type === 'robot.telemetry' &&
      latestMessage.payload
    ) {
      const payload = latestMessage.payload;

      setTelemetry({
        timestamp: Date.parse(latestMessage.received_at),
        batteryLevel: payload.battery_level_pct,
        connectionStatus: payload.connection_status,
        linearVelocity: payload.linear_velocity,
        angularVelocity: payload.angular_velocity,
        isStale: payload.is_stale,
        positionX: payload.position_x,
        positionY: payload.position_y,
        positionZ: payload.position_z,
        yaw: payload.yaw,
        safetyState: payload.safety_state,
      });
    }
  }

  return {
    telemetry: telemetry
      ? {
          ...telemetry,
          isStale:
            telemetry.isStale ||
            !isConnected ||
            now - telemetry.timestamp > 2000,
        }
      : null,
    isConnected,
    status,
  };
};
