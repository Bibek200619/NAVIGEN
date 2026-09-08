import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMissions } from '../useMissions';
import { apiClient } from '../../services/api';
import type { Page, MissionResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  apiClient: {
    getMissions: vi.fn(),
  },
}));

describe('useMissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch missions until a valid robot ID exists (guard test)', async () => {
    const { result } = renderHook(() => useMissions(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.missions).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(apiClient.getMissions).not.toHaveBeenCalled();
  });

  it('fetches mission list successfully when robot ID is provided', async () => {
    const mockMissionsPage: Page<MissionResponse> = {
      items: [
        {
          id: 'mission-1',
          robot_id: 'robot-1',
          name: 'Perimeter Check',
          description: 'Survey perimeter boundary',
          status: 'in_progress',
          created_by: 'user-1',
          started_at: '2026-09-04T12:00:00Z',
          completed_at: null,
          failure_reason: null,
          created_at: '2026-09-04T12:00:00Z',
          updated_at: '2026-09-04T12:00:00Z',
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    };

    vi.mocked(apiClient.getMissions).mockResolvedValueOnce(mockMissionsPage);

    const { result } = renderHook(() => useMissions('robot-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getMissions).toHaveBeenCalledWith({
      robot_id: 'robot-1',
      status: undefined,
      limit: 50,
      offset: 0,
    });
    expect(result.current.missions.length).toBe(1);
    expect(result.current.missions[0].id).toBe('mission-1');
    expect(result.current.missions[0].robotId).toBe('robot-1');
    expect(result.current.missions[0].status).toBe('in_progress');
    expect(result.current.error).toBeNull();
  });

  it('handles empty mission list returned from backend', async () => {
    vi.mocked(apiClient.getMissions).mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    const { result } = renderHook(() => useMissions('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.missions).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('handles mission API error without crashing', async () => {
    const errorMsg = 'Failed to fetch missions';
    vi.mocked(apiClient.getMissions).mockRejectedValueOnce(new Error(errorMsg));

    const { result } = renderHook(() => useMissions('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.missions).toEqual([]);
    expect(result.current.error?.message).toBe(errorMsg);
  });
});
