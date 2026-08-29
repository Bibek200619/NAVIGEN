export interface TelemetryData {
  timestamp: number;
  batteryLevel?: number;
  connectionStatus?: 'connected' | 'disconnected' | 'connecting';
  linearVelocity?: number;
  angularVelocity?: number;
}
