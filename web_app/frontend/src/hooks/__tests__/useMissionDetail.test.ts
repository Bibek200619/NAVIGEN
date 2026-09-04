import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMissionDetail } from '../useMissionDetail';
import { apiClient } from '../../services/api';
import type { MissionDetailResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  apiClient: {
    getMission: vi.fn(),
  },
}));

describe('useMissionDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch mission detail until a valid mission ID exists (guard test)', async () => {
    const { result } = renderHook(() => useMissionDetail(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.mission).toBeNull();
    expect(result.current.goals).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(apiClient.getMission).not.toHaveBeenCalled();
  });

  it('fetches detailed mission and goals successfully when mission ID is provided', async () => {
    const mockDetail: MissionDetailResponse = {
      id: 'mission-42',
      robot_id: 'robot-1',
      name: 'Waypoints Route',
      description: 'Test waypoint mission',
      status: 'in_progress',
      created_by: 'user-1',
      started_at: '2026-09-04T12:00:00Z',
      completed_at: null,
      failure_reason: null,
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
      goals: [
        {
          id: 'goal-1',
          mission_id: 'mission-42',
          sequence_no: 1,
          frame_id: 'map',
          position_x: 2.5,
          position_y: 3.5,
          position_z: 0.0,
          orientation_x: 0.0,
          orientation_y: 0.0,
          orientation_z: 0.0,
          orientation_w: 1.0,
          reached_at: '2026-09-04T12:05:00Z',
          created_at: '2026-09-04T12:00:00Z',
        },
        {
          id: 'goal-2',
          mission_id: 'mission-42',
          sequence_no: 2,
          frame_id: 'map',
          position_x: 5.0,
          position_y: 7.0,
          position_z: 0.0,
          orientation_x: 0.0,
          orientation_y: 0.0,
          orientation_z: 0.0,
          orientation_w: 1.0,
          reached_at: null,
          created_at: '2026-09-04T12:00:00Z',
        },
      ],
    };

    vi.mocked(apiClient.getMission).mockResolvedValueOnce(mockDetail);

    const { result } = renderHook(() => useMissionDetail('mission-42'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getMission).toHaveBeenCalledWith('mission-42');
    expect(result.current.mission?.id).toBe('mission-42');
    expect(result.current.mission?.goals?.length).toBe(2);
    expect(result.current.goals.length).toBe(2);
    expect(result.current.goals[0].position.x).toBe(2.5);
    expect(result.current.goals[0].reachedAt).toBe('2026-09-04T12:05:00Z');
    expect(result.current.goals[1].reachedAt).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles mission detail API error without crashing', async () => {
    const errorMsg = 'Mission not found';
    vi.mocked(apiClient.getMission).mockRejectedValueOnce(new Error(errorMsg));

    const { result } = renderHook(() => useMissionDetail('invalid-id'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.mission).toBeNull();
    expect(result.current.goals).toEqual([]);
    expect(result.current.error?.message).toBe(errorMsg);
  });
});
