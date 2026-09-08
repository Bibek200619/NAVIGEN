import type {
  MissionStatus,
  MissionResponse,
  MissionGoalResponse,
  MissionDetailResponse,
} from './api';

export interface Goal {
  id: string;
  missionId: string;
  sequenceNo: number;
  frameId: string;
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
  reachedAt: string | null;
  createdAt: string;
}

export interface Mission {
  id: string;
  robotId?: string;
  name: string;
  description?: string | null;
  status: MissionStatus;
  createdBy?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  failureReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  goals?: Goal[];
}

export function mapGoalResponseToGoal(response: MissionGoalResponse): Goal {
  return {
    id: response.id,
    missionId: response.mission_id,
    sequenceNo: response.sequence_no,
    frameId: response.frame_id,
    position: {
      x: response.position_x,
      y: response.position_y,
      z: response.position_z,
    },
    orientation: {
      x: response.orientation_x,
      y: response.orientation_y,
      z: response.orientation_z,
      w: response.orientation_w,
    },
    reachedAt: response.reached_at,
    createdAt: response.created_at,
  };
}

export function mapMissionResponseToMission(
  response: MissionResponse | MissionDetailResponse,
): Mission {
  const goals =
    'goals' in response && Array.isArray(response.goals)
      ? response.goals.map(mapGoalResponseToGoal)
      : undefined;

  return {
    id: response.id,
    robotId: response.robot_id,
    name: response.name,
    description: response.description,
    status: response.status,
    createdBy: response.created_by,
    startedAt: response.started_at,
    completedAt: response.completed_at,
    failureReason: response.failure_reason,
    createdAt: response.created_at,
    updatedAt: response.updated_at,
    goals,
  };
}
