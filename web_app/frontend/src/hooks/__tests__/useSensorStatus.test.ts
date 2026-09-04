import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSensorStatus } from '../useSensorStatus';
import { apiClient } from '../../services/api';
import type { SensorStatusResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  apiClient: {
    getRobotSensors: vi.fn(),
  },
}));

describe('useSensorStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch sensors until a valid robot ID exists (guard test)', async () => {
    const { result } = renderHook(() => useSensorStatus(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.sensors).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(apiClient.getRobotSensors).not.toHaveBeenCalled();
  });

  it('fetches sensor status list successfully when robot ID is provided', async () => {
    const mockSensors: SensorStatusResponse[] = [
      {
        id: 'sensor-1',
        robot_id: 'robot-1',
        sensor_key: 'camera',
        name: 'Front Camera',
        topic: '/camera/image_raw',
        is_active: true,
        frequency_hz: 30.0,
        last_updated_at: '2026-09-04T12:00:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
      {
        id: 'sensor-2',
        robot_id: 'robot-1',
        sensor_key: 'imu',
        name: 'IMU Sensor',
        topic: '/imu/data',
        is_active: false,
        frequency_hz: 100.0,
        last_updated_at: '2026-09-04T11:59:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
    ];

    vi.mocked(apiClient.getRobotSensors).mockResolvedValueOnce(mockSensors);

    const { result } = renderHook(() => useSensorStatus('robot-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getRobotSensors).toHaveBeenCalledWith('robot-1');
    expect(result.current.sensors).toEqual(mockSensors);
    expect(result.current.error).toBeNull();
  });

  it('handles empty sensor list returned from backend', async () => {
    vi.mocked(apiClient.getRobotSensors).mockResolvedValueOnce([]);

    const { result } = renderHook(() => useSensorStatus('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sensors).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('handles sensor API error without crashing', async () => {
    const errorMessage = 'Failed to fetch robot sensors';
    vi.mocked(apiClient.getRobotSensors).mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useSensorStatus('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sensors).toEqual([]);
    expect(result.current.error?.message).toBe(errorMessage);
  });
});
