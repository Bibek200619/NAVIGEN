import type { TelemetryData } from '../types/telemetry';

/**
 * Temporary mock telemetry generator for UI development.
 */
export const getMockTelemetry = (): TelemetryData => ({
  timestamp: Date.now(),
  batteryLevel: 88,
  connectionStatus: 'connected',
  linearVelocity: 0.0,
  angularVelocity: 0.0,
});
