import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSafetyStatus } from '../useSafetyStatus';
import { apiClient } from '../../services/api';
import type { SafetyEventResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  apiClient: {
    getRobotSafety: vi.fn(),
  },
}));

describe('useSafetyStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch safety data until a valid robot ID exists (guard test)', async () => {
    const { result } = renderHook(() => useSafetyStatus(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.safetyEvents).toEqual([]);
    expect(result.current.latestEvent).toBeNull();
    expect(result.current.error).toBeNull();
    expect(apiClient.getRobotSafety).not.toHaveBeenCalled();
  });

  it('fetches safety events successfully and exposes the latest event in backend order', async () => {
    const mockEvents: SafetyEventResponse[] = [
      {
        id: 'safety-event-1',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:00Z',
        received_at: '2026-09-04T12:00:01Z',
        state: 'warning',
        active_triggers: ['obstacle_proximity'],
        description: 'Proximity sensor triggered warning threshold',
        created_at: '2026-09-04T12:00:01Z',
      },
      {
        id: 'safety-event-2',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T11:55:00Z',
        received_at: '2026-09-04T11:55:01Z',
        state: 'ok',
        active_triggers: [],
        description: 'Normal operations',
        created_at: '2026-09-04T11:55:01Z',
      },
    ];

    vi.mocked(apiClient.getRobotSafety).mockResolvedValueOnce(mockEvents);

    const { result } = renderHook(() => useSafetyStatus('robot-1', { limit: 10 }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getRobotSafety).toHaveBeenCalledWith('robot-1', { limit: 10 });
    expect(result.current.safetyEvents).toEqual(mockEvents);
    // Verifies backend ordering is preserved
    expect(result.current.latestEvent).toEqual(mockEvents[0]);
    expect(result.current.error).toBeNull();
  });

  it('handles empty safety event response correctly', async () => {
    vi.mocked(apiClient.getRobotSafety).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useSafetyStatus('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.safetyEvents).toEqual([]);
    expect(result.current.latestEvent).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles safety API error without crashing', async () => {
    const errorMsg = 'Failed to fetch safety status';
    vi.mocked(apiClient.getRobotSafety).mockRejectedValueOnce(new Error(errorMsg));

    const { result } = renderHook(() => useSafetyStatus('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.safetyEvents).toEqual([]);
    expect(result.current.latestEvent).toBeNull();
    expect(result.current.error?.message).toBe(errorMsg);
  });
});
