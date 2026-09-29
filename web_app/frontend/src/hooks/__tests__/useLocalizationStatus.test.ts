import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useLocalizationStatus } from '../useLocalizationStatus';
import { apiClient } from '../../services/api';
import type { LocalizationStatusResponse } from '../../types/api';

vi.mock('../../services/api', () => ({
  apiClient: {
    getRobotLocalization: vi.fn(),
  },
}));

describe('useLocalizationStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not fetch localization until a valid robot ID exists (guard test)', async () => {
    const { result } = renderHook(() => useLocalizationStatus(null));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.localization).toBeNull();
    expect(result.current.error).toBeNull();
    expect(apiClient.getRobotLocalization).not.toHaveBeenCalled();
  });

  it('fetches localization status successfully when robot ID is provided', async () => {
    const mockLoc: LocalizationStatusResponse = {
      id: 'loc-1',
      robot_id: 'robot-1',
      recorded_at: '2026-09-04T12:00:00Z',
      received_at: '2026-09-04T12:00:01Z',
      state: 'tracking',
      tracked_features: 428,
      created_at: '2026-09-04T12:00:01Z',
    };

    vi.mocked(apiClient.getRobotLocalization).mockResolvedValueOnce(mockLoc);

    const { result } = renderHook(() => useLocalizationStatus('robot-1'));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.getRobotLocalization).toHaveBeenCalledWith('robot-1');
    expect(result.current.localization).toEqual(mockLoc);
    expect(result.current.error).toBeNull();
  });

  it('handles localization API error without crashing', async () => {
    const errorMsg = 'Failed to fetch localization status';
    vi.mocked(apiClient.getRobotLocalization).mockRejectedValueOnce(new Error(errorMsg));

    const { result } = renderHook(() => useLocalizationStatus('robot-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.localization).toBeNull();
    expect(result.current.error?.message).toBe(errorMsg);
  });
});
