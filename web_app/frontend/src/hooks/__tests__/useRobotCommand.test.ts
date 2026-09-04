import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRobotCommand } from '../useRobotCommand';
import { apiClient, ApiError } from '../../services/api';
import type { CommandResponse } from '../../types/api';

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual('../../services/api');
  return {
    ...actual,
    apiClient: {
      createRobotCommand: vi.fn(),
    },
  };
});

describe('useRobotCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('guards against missing robot ID', async () => {
    const { result } = renderHook(() => useRobotCommand());

    await act(async () => {
      await expect(
        result.current.sendSetGoal('', {
          frame_id: 'map',
          position: { x: 0, y: 0, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        }),
      ).rejects.toThrow('Cannot send command without an active robot ID.');
    });

    expect(result.current.error?.message).toBe(
      'Cannot send command without an active robot ID.',
    );
    expect(apiClient.createRobotCommand).not.toHaveBeenCalled();
  });

  it('dispatches set_goal command with correct payload and updates lifecycle status', async () => {
    const mockResponse: CommandResponse = {
      id: 'cmd-goal-1',
      robot_id: 'robot-1',
      mission_id: 'mission-1',
      requested_by: 'user-1',
      command_type: 'set_goal',
      status: 'accepted',
      request_payload: {
        frame_id: 'map',
        position: { x: 1.5, y: 2.5, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
      response_payload: null,
      rejection_reason: null,
      failure_reason: null,
      requested_at: '2026-09-04T12:00:00Z',
      acknowledged_at: '2026-09-04T12:00:01Z',
      executed_at: null,
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:01Z',
    };

    vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useRobotCommand());

    let commandResult: CommandResponse | undefined;
    await act(async () => {
      commandResult = await result.current.sendSetGoal(
        'robot-1',
        {
          frame_id: 'map',
          position: { x: 1.5, y: 2.5, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
        'mission-1',
      );
    });

    expect(apiClient.createRobotCommand).toHaveBeenCalledWith('robot-1', {
      mission_id: 'mission-1',
      command_type: 'set_goal',
      payload: {
        frame_id: 'map',
        position: { x: 1.5, y: 2.5, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      },
    });

    expect(commandResult).toEqual(mockResponse);
    expect(result.current.lastCommand).toEqual(mockResponse);
    expect(result.current.lastCommand?.status).toBe('accepted');
    expect(result.current.error).toBeNull();
  });

  it('dispatches software_estop command with safety payload', async () => {
    const mockResponse: CommandResponse = {
      id: 'cmd-estop-1',
      robot_id: 'robot-1',
      mission_id: null,
      requested_by: 'user-1',
      command_type: 'software_estop',
      status: 'executed',
      request_payload: { active: true },
      response_payload: null,
      rejection_reason: null,
      failure_reason: null,
      requested_at: '2026-09-04T12:00:00Z',
      acknowledged_at: '2026-09-04T12:00:01Z',
      executed_at: '2026-09-04T12:00:02Z',
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:02Z',
    };

    vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useRobotCommand());

    let commandResult: CommandResponse | undefined;
    await act(async () => {
      commandResult = await result.current.sendSoftwareEstop('robot-1', true);
    });

    expect(apiClient.createRobotCommand).toHaveBeenCalledWith('robot-1', {
      mission_id: null,
      command_type: 'software_estop',
      payload: { active: true },
    });

    expect(commandResult).toEqual(mockResponse);
    expect(result.current.lastCommand?.status).toBe('executed');
  });

  it('handles rejected command with rejection reason', async () => {
    const mockResponse: CommandResponse = {
      id: 'cmd-rejected-1',
      robot_id: 'robot-1',
      mission_id: null,
      requested_by: 'user-1',
      command_type: 'set_goal',
      status: 'rejected',
      request_payload: {},
      response_payload: null,
      rejection_reason: 'Robot is currently in manual emergency mode',
      failure_reason: null,
      requested_at: '2026-09-04T12:00:00Z',
      acknowledged_at: '2026-09-04T12:00:01Z',
      executed_at: null,
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:01Z',
    };

    vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useRobotCommand());

    await act(async () => {
      await result.current.sendSetGoal('robot-1', {
        frame_id: 'map',
        position: { x: 0, y: 0, z: 0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      });
    });

    expect(result.current.lastCommand?.status).toBe('rejected');
    expect(result.current.lastCommand?.rejection_reason).toBe(
      'Robot is currently in manual emergency mode',
    );
  });

  it('translates HTTP 401 into "Authentication required / session unavailable"', async () => {
    const apiError = new ApiError('Unauthorized', 401, 'Unauthorized');
    vi.mocked(apiClient.createRobotCommand).mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useRobotCommand());

    await act(async () => {
      await expect(
        result.current.sendSoftwareEstop('robot-1', true),
      ).rejects.toThrow('Authentication required / session unavailable');
    });

    expect(result.current.error?.message).toBe(
      'Authentication required / session unavailable',
    );
  });

  it('translates HTTP 403 into "Operator permission required for this action"', async () => {
    const apiError = new ApiError('Forbidden', 403, 'Forbidden');
    vi.mocked(apiClient.createRobotCommand).mockRejectedValueOnce(apiError);

    const { result } = renderHook(() => useRobotCommand());

    await act(async () => {
      await expect(
        result.current.sendSoftwareEstop('robot-1', true),
      ).rejects.toThrow('Operator permission required for this action');
    });

    expect(result.current.error?.message).toBe(
      'Operator permission required for this action',
    );
  });
});
