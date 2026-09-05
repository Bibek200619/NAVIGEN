export interface TelemetryData {
  timestamp: number;
  batteryLevel?: number;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  linearVelocity?: number;
  angularVelocity?: number;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  yaw?: number;
  safetyState?: 'ok' | 'warning' | 'emergency_stop';
  isStale?: boolean;
}
