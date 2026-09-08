/**
 * TypeScript types matching backend REST v1 API contracts.
 */

export type RobotStatus = 'idle' | 'navigating' | 'manual' | 'offline' | 'error';

export type ConnectionStatus = 'connected' | 'disconnected' | 'connecting';

export type SafetyState = 'ok' | 'warning' | 'emergency_stop';

export type LocalizationState = 'initializing' | 'tracking' | 'lost' | 'relocalizing';

export interface Robot {
  id: string;
  name: string;
  slug: string;
  status: RobotStatus;
  connection_status: ConnectionStatus;
  last_seen_at: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type RobotResponse = Robot;

export interface RobotTelemetryResponse {
  id: string | null;
  robot_id: string;
  recorded_at: string;
  received_at: string;
  connection_status: ConnectionStatus;
  is_stale: boolean;
  data_age_ms: number;
  position_x: number | null;
  position_y: number | null;
  position_z: number | null;
  yaw: number | null;
  linear_velocity: number | null;
  angular_velocity: number | null;
  battery_level_pct: number | null;
  safety_state: SafetyState | null;
  localization_state: LocalizationState | null;
  created_at: string | null;
}

export interface SensorStatusResponse {
  id: string;
  robot_id: string;
  sensor_key: string;
  name: string;
  topic: string | null;
  is_active: boolean;
  frequency_hz: number | null;
  last_updated_at: string | null;
  details: Record<string, unknown>;
  updated_at: string;
}

export interface SafetyEventResponse {
  id: string | null;
  robot_id: string;
  recorded_at: string;
  received_at: string;
  state: SafetyState;
  active_triggers: string[];
  description: string | null;
  created_at: string | null;
}

export interface LocalizationStatusResponse {
  id: string | null;
  robot_id: string;
  recorded_at: string;
  received_at: string;
  state: LocalizationState;
  tracked_features: number;
  created_at: string | null;
}

export interface SystemStatusResponse {
  status: string;
  version: string;
  database: 'connected' | 'disconnected';
  ugv_bridge: 'connected' | 'disconnected';
}

export type SystemStatus = SystemStatusResponse;

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListRobotsParams {
  limit?: number;
  offset?: number;
}

export interface GetTelemetryParams {
  from?: string;
  to?: string;
  limit?: number;
}

export interface GetSafetyParams {
  limit?: number;
}

// ------------------------------------------------------------------
// Mission & Command API contracts
// ------------------------------------------------------------------

export type MissionStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'aborted';

export interface MissionResponse {
  id: string;
  robot_id: string;
  name: string;
  description: string | null;
  status: MissionStatus;
  created_by: string;
  started_at: string | null;
  completed_at: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface MissionGoalResponse {
  id: string;
  mission_id: string;
  sequence_no: number;
  frame_id: string;
  position_x: number;
  position_y: number;
  position_z: number;
  orientation_x: number;
  orientation_y: number;
  orientation_z: number;
  orientation_w: number;
  reached_at: string | null;
  created_at: string;
}

export interface MissionDetailResponse extends MissionResponse {
  goals: MissionGoalResponse[];
}

export type CommandType = 'set_goal' | 'software_estop';

export type CommandStatus = 'pending' | 'accepted' | 'rejected' | 'executed' | 'failed';

export interface CommandResponse {
  id: string;
  robot_id: string;
  mission_id: string | null;
  requested_by: string;
  command_type: CommandType;
  status: CommandStatus;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown> | null;
  rejection_reason: string | null;
  failure_reason: string | null;
  requested_at: string;
  acknowledged_at: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetGoalPayload {
  frame_id: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  orientation: {
    x: number;
    y: number;
    z: number;
    w: number;
  };
}

export interface SoftwareEstopPayload {
  active: boolean;
}

export interface CommandCreate {
  mission_id?: string | null;
  command_type: CommandType;
  payload: SetGoalPayload | SoftwareEstopPayload | Record<string, unknown>;
}

export interface ListMissionsParams {
  robot_id?: string;
  status?: MissionStatus;
  limit?: number;
  offset?: number;
}

export interface MissionGoalCreate {
  sequence_no?: number | null;
  frame_id?: string;
  position_x: number;
  position_y: number;
  position_z?: number;
  orientation_x?: number;
  orientation_y?: number;
  orientation_z: number;
  orientation_w: number;
}

export interface MissionCreate {
  robot_id: string;
  name: string;
  description?: string | null;
  goals?: MissionGoalCreate[];
}

export interface MissionUpdate {
  name?: string | null;
  description?: string | null;
  status?: MissionStatus | null;
  failure_reason?: string | null;
}
