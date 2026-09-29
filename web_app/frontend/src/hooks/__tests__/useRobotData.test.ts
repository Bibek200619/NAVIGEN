import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRobotData } from '../useRobotData';
import { apiClient } from '../../services/api';
import type { Robot } from '../../types/api';

vi.mock('../../services/api', () => ({
  apiClient: {
    getRobots: vi.fn(),
  },
}));

describe('useRobotData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('handles robot REST hook success and selects first robot as default', async () => {
    const mockRobots: Robot[] = [
      {
        id: 'robot-uuid-1',
        name: 'UGV Unit 1',
        slug: 'ugv-1',
        status: 'navigating',
        connection_status: 'connected',
        last_seen_at: '2026-09-04T12:00:00Z',
        description: 'Primary exploration unit',
        metadata: {},
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-04T12:00:00Z',
      },
      {
        id: 'robot-uuid-2',
        name: 'UGV Unit 2',
        slug: 'ugv-2',
        status: 'idle',
        connection_status: 'disconnected',
        last_seen_at: null,
        description: null,
        metadata: {},
        created_at: '2026-09-01T00:00:00Z',
        updated_at: '2026-09-01T00:00:00Z',
      },
    ];

    vi.mocked(apiClient.getRobots).mockResolvedValueOnce({
      items: mockRobots,
      total: 2,
      limit: 50,
      offset: 0,
    });

    const { result } = renderHook(() => useRobotData());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.robots).toEqual(mockRobots);
    expect(result.current.selectedRobot).toEqual(mockRobots[0]);
    expect(result.current.selectedRobotId).toBe('robot-uuid-1');
    expect(result.current.error).toBeNull();
  });

  it('handles robot REST hook empty state when zero robots are returned', async () => {
    vi.mocked(apiClient.getRobots).mockResolvedValueOnce({
      items: [],
      total: 0,
      limit: 50,
      offset: 0,
    });

    const { result } = renderHook(() => useRobotData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.robots).toEqual([]);
    expect(result.current.selectedRobot).toBeNull();
    expect(result.current.selectedRobotId).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('handles robot REST hook error state', async () => {
    const errorMsg = 'Failed to connect to backend';
    vi.mocked(apiClient.getRobots).mockRejectedValueOnce(new Error(errorMsg));

    const { result } = renderHook(() => useRobotData());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.robots).toEqual([]);
    expect(result.current.selectedRobot).toBeNull();
    expect(result.current.error?.message).toBe(errorMsg);
  });
});
