import type { SafetyState, LocalizationState, ConnectionStatus } from './api';

export interface TelemetryPosition {
  x: number | null;
  y: number | null;
  z: number | null;
  yaw: number | null;
}

export interface TelemetryData {
  timestamp: number;
  batteryLevel?: number;
  connectionStatus?: ConnectionStatus;
  linearVelocity?: number;
  angularVelocity?: number;
  isStale?: boolean;

  // Extended fields supporting backend RobotTelemetryResponse
  positionX?: number | null;
  positionY?: number | null;
  positionZ?: number | null;
  yaw?: number | null;
  position?: TelemetryPosition;
  safetyState?: SafetyState | null;
  localizationState?: LocalizationState | null;
  dataAgeMs?: number;
  recordedAt?: string;
  receivedAt?: string;

  // Snake_case aliases matching raw backend schema
  position_x?: number | null;
  position_y?: number | null;
  position_z?: number | null;
  linear_velocity?: number | null;
  angular_velocity?: number | null;
  battery_level_pct?: number | null;
  safety_state?: SafetyState | null;
  localization_state?: LocalizationState | null;
  is_stale?: boolean;
  data_age_ms?: number;
  recorded_at?: string;
  received_at?: string;
}
