import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTelemetryHistory } from '../useTelemetryHistory';
import { apiClient } from '../../services/api';
import type { RobotTelemetryResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  apiClient: {
    getRobotTelemetry: vi.fn(),
  },
}));

describe('useTelemetryHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch telemetry until a valid robot ID exists', async () => {
    const { result } = renderHook(() => useTelemetryHistory(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(apiClient.getRobotTelemetry).not.toHaveBeenCalled();
  });

  it('fetches telemetry history successfully when robot ID is provided', async () => {
    const mockSamples: RobotTelemetryResponse[] = [
      {
        id: 'sample-1',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:00Z',
        received_at: '2026-09-04T12:00:01Z',
        connection_status: 'connected',
        is_stale: false,
        data_age_ms: 100,
        position_x: 1.25,
        position_y: 2.5,
        position_z: 0.1,
        yaw: 0.78,
        linear_velocity: 0.42,
        angular_velocity: 0.05,
        battery_level_pct: 85.0,
        safety_state: 'ok',
        localization_state: 'tracking',
        created_at: '2026-09-04T12:00:01Z',
      },
    ];

    vi.mocked(apiClient.getRobotTelemetry).mockResolvedValueOnce(mockSamples);

    const { result } = renderHook(() => useTelemetryHistory('robot-1', { limit: 50 }));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getRobotTelemetry).toHaveBeenCalledWith('robot-1', {
      limit: 50,
      from: undefined,
      to: undefined,
    });
    expect(result.current.history).toEqual(mockSamples);
    expect(result.current.error).toBeNull();
  });

  it('handles telemetry history empty state', async () => {
    vi.mocked(apiClient.getRobotTelemetry).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useTelemetryHistory('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('handles telemetry history error state without crashing', async () => {
    const errorMsg = 'Failed to fetch telemetry history';
    vi.mocked(apiClient.getRobotTelemetry).mockRejectedValueOnce(new Error(errorMsg));

    const { result } = renderHook(() => useTelemetryHistory('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.history).toEqual([]);
    expect(result.current.error?.message).toBe(errorMsg);
  });
});
