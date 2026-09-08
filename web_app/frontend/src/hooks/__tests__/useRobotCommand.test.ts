import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRobotCommand } from '../useRobotCommand';
import { apiClient, ApiError } from '../../services/api';
import type { CommandResponse } from '../../types/api';
import type { WebSocketEnvelope } from '../../services/websocket';

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual('../../services/api');
  return {
    ...actual,
    apiClient: {
      createRobotCommand: vi.fn(),
      getCommand: vi.fn(),
    },
  };
});

let messageHandlers: Set<(envelope: WebSocketEnvelope<unknown>) => void> = new Set();
const mockConnect = vi.fn();
const mockOnMessage = vi.fn((handler: (envelope: WebSocketEnvelope<unknown>) => void) => {
  messageHandlers.add(handler);
  return () => {
    messageHandlers.delete(handler);
  };
});

vi.mock('../../services/websocket', () => ({
  wsService: {
    connect: (...args: unknown[]) => mockConnect(...args),
    onMessage: (handler: (envelope: WebSocketEnvelope<unknown>) => void) => mockOnMessage(handler),
  },
}));

const emitWsMessage = (envelope: WebSocketEnvelope<unknown>) => {
  act(() => {
    messageHandlers.forEach((handler) => handler(envelope));
  });
};

describe('useRobotCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    messageHandlers = new Set();
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

  describe('Lifecycle Tracking & Reconciliation', () => {
    const basePendingCommand: CommandResponse = {
      id: 'cmd-live-1',
      robot_id: 'robot-1',
      mission_id: 'mission-1',
      requested_by: 'user-1',
      command_type: 'set_goal',
      status: 'pending',
      request_payload: { position: { x: 1, y: 2, z: 0 } },
      response_payload: null,
      rejection_reason: null,
      failure_reason: null,
      requested_at: '2026-09-04T12:00:00Z',
      acknowledged_at: null,
      executed_at: null,
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
    };

    it('tracks lifecycle transition: PENDING → ACCEPTED via WebSocket command.updated', async () => {
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      expect(result.current.lastCommand?.status).toBe('pending');
      expect(mockConnect).toHaveBeenCalled();
      expect(messageHandlers.size).toBe(1);

      // Simulate incoming command.updated WebSocket event
      const acceptedCommand: CommandResponse = {
        ...basePendingCommand,
        status: 'accepted',
        acknowledged_at: '2026-09-04T12:00:01Z',
        updated_at: '2026-09-04T12:00:01Z',
      };

      emitWsMessage({
        schema_version: 1,
        event_type: 'command.updated',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:01Z',
        received_at: '2026-09-04T12:00:01Z',
        payload: acceptedCommand,
      });

      expect(result.current.lastCommand?.status).toBe('accepted');
      expect(result.current.lastCommand?.acknowledged_at).toBe('2026-09-04T12:00:01Z');
    });

    it('tracks lifecycle transition: ACCEPTED → EXECUTED via WebSocket command.updated', async () => {
      const acceptedCommand: CommandResponse = {
        ...basePendingCommand,
        status: 'accepted',
        acknowledged_at: '2026-09-04T12:00:01Z',
      };

      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(acceptedCommand);

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      expect(result.current.lastCommand?.status).toBe('accepted');

      const executedCommand: CommandResponse = {
        ...acceptedCommand,
        status: 'executed',
        executed_at: '2026-09-04T12:00:02Z',
        updated_at: '2026-09-04T12:00:02Z',
      };

      emitWsMessage({
        schema_version: 1,
        event_type: 'command.updated',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:02Z',
        received_at: '2026-09-04T12:00:02Z',
        payload: executedCommand,
      });

      expect(result.current.lastCommand?.status).toBe('executed');
      expect(result.current.lastCommand?.executed_at).toBe('2026-09-04T12:00:02Z');
    });

    it('tracks lifecycle transition: PENDING → REJECTED with rejection_reason preserved', async () => {
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      const rejectedCommand: CommandResponse = {
        ...basePendingCommand,
        status: 'rejected',
        rejection_reason: 'Waypoint unreachable due to obstacle cluster',
        updated_at: '2026-09-04T12:00:01Z',
      };

      emitWsMessage({
        schema_version: 1,
        event_type: 'command.updated',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:01Z',
        received_at: '2026-09-04T12:00:01Z',
        payload: rejectedCommand,
      });

      expect(result.current.lastCommand?.status).toBe('rejected');
      expect(result.current.lastCommand?.rejection_reason).toBe(
        'Waypoint unreachable due to obstacle cluster',
      );
    });

    it('tracks lifecycle transition: ACCEPTED → FAILED with failure_reason preserved', async () => {
      const acceptedCommand: CommandResponse = {
        ...basePendingCommand,
        status: 'accepted',
      };
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(acceptedCommand);

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      const failedCommand: CommandResponse = {
        ...acceptedCommand,
        status: 'failed',
        failure_reason: 'UGV motor controller timeout during trajectory tracking',
        updated_at: '2026-09-04T12:00:03Z',
      };

      emitWsMessage({
        schema_version: 1,
        event_type: 'command.updated',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:03Z',
        received_at: '2026-09-04T12:00:03Z',
        payload: failedCommand,
      });

      expect(result.current.lastCommand?.status).toBe('failed');
      expect(result.current.lastCommand?.failure_reason).toBe(
        'UGV motor controller timeout during trajectory tracking',
      );
    });

    it('ignores command.updated events for unrelated command IDs', async () => {
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      // Emit update for a different command ID
      emitWsMessage({
        schema_version: 1,
        event_type: 'command.updated',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:01Z',
        received_at: '2026-09-04T12:00:01Z',
        payload: {
          ...basePendingCommand,
          id: 'other-cmd-999',
          status: 'executed',
        },
      });

      // Active command must remain unchanged
      expect(result.current.lastCommand?.id).toBe('cmd-live-1');
      expect(result.current.lastCommand?.status).toBe('pending');
    });

    it('removes WebSocket listener when command reaches terminal state (executed/rejected/failed)', async () => {
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      expect(messageHandlers.size).toBe(1);

      // Transition to terminal state EXECUTED
      emitWsMessage({
        schema_version: 1,
        event_type: 'command.updated',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:02Z',
        received_at: '2026-09-04T12:00:02Z',
        payload: {
          ...basePendingCommand,
          status: 'executed',
          executed_at: '2026-09-04T12:00:02Z',
        },
      });

      expect(result.current.lastCommand?.status).toBe('executed');
      // Listener is cleaned up since command reached terminal status
      expect(messageHandlers.size).toBe(0);
    });

    it('cleans up WebSocket listener on reset() and on unmount', async () => {
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);

      const { result, unmount } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      expect(messageHandlers.size).toBe(1);

      // Calling reset() cleans up the active listener
      act(() => {
        result.current.reset();
      });

      expect(result.current.lastCommand).toBeNull();
      expect(messageHandlers.size).toBe(0);

      // Verify unmount cleanup as well
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);
      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });
      expect(messageHandlers.size).toBe(1);

      unmount();
      expect(messageHandlers.size).toBe(0);
    });

    it('reconciles active command status via GET /commands/{command_id} fallback polling', async () => {
      vi.useFakeTimers();

      try {
        vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);
        vi.mocked(apiClient.getCommand).mockResolvedValueOnce({
          ...basePendingCommand,
          status: 'executed',
          executed_at: '2026-09-04T12:00:05Z',
        });

        const { result } = renderHook(() =>
          useRobotCommand({ reconciliationIntervalMs: 1000 }),
        );

        await act(async () => {
          await result.current.sendSetGoal('robot-1', {
            frame_id: 'map',
            position: { x: 1, y: 2, z: 0 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
          });
        });

        expect(result.current.lastCommand?.status).toBe('pending');
        expect(apiClient.getCommand).not.toHaveBeenCalled();

        // Advance timers by the reconciliation interval
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });

        expect(apiClient.getCommand).toHaveBeenCalledWith('cmd-live-1');
        expect(result.current.lastCommand?.status).toBe('executed');
      } finally {
        vi.useRealTimers();
      }
    });

    it('explicit reconcile() method updates command from REST API', async () => {
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);
      vi.mocked(apiClient.getCommand).mockResolvedValueOnce({
        ...basePendingCommand,
        status: 'accepted',
        acknowledged_at: '2026-09-04T12:00:01Z',
      });

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      let reconciled: CommandResponse | null = null;
      await act(async () => {
        reconciled = (await result.current.reconcile?.()) ?? null;
      });

      expect(apiClient.getCommand).toHaveBeenCalledWith('cmd-live-1');
      expect(reconciled).not.toBeNull();
      expect((reconciled as CommandResponse | null)?.status).toBe('accepted');
      expect(result.current.lastCommand?.status).toBe('accepted');
    });

    it('regression: prevents stale REST reconciliation response from overwriting newer WebSocket ACCEPTED state', async () => {
      vi.useFakeTimers();
      try {
        vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);

        // Stale REST endpoint returns delayed 'pending'
        vi.mocked(apiClient.getCommand).mockResolvedValue({
          ...basePendingCommand,
          status: 'pending',
          updated_at: '2026-09-04T12:00:00Z',
        });

        const { result } = renderHook(() =>
          useRobotCommand({ reconciliationIntervalMs: 1000 }),
        );

        // 1. Dispatch goal -> starts with 'pending'
        await act(async () => {
          await result.current.sendSetGoal('robot-1', {
            frame_id: 'map',
            position: { x: 1, y: 2, z: 0 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
          });
        });

        expect(result.current.lastCommand?.status).toBe('pending');

        // 2. WebSocket delivers ACCEPTED update
        const acceptedCommand: CommandResponse = {
          ...basePendingCommand,
          status: 'accepted',
          acknowledged_at: '2026-09-04T12:00:01Z',
          updated_at: '2026-09-04T12:00:01Z',
        };

        emitWsMessage({
          schema_version: 1,
          event_type: 'command.updated',
          robot_id: 'robot-1',
          recorded_at: '2026-09-04T12:00:01Z',
          received_at: '2026-09-04T12:00:01Z',
          payload: acceptedCommand,
        });

        expect(result.current.lastCommand?.status).toBe('accepted');

        // 3. Polling interval fires and returns stale REST 'pending' response
        await act(async () => {
          vi.advanceTimersByTime(1000);
        });

        expect(apiClient.getCommand).toHaveBeenCalledWith('cmd-live-1');

        // Status MUST NOT revert back to 'pending'; it remains 'accepted'
        expect(result.current.lastCommand?.status).toBe('accepted');
        expect(result.current.lastCommand?.acknowledged_at).toBe('2026-09-04T12:00:01Z');
      } finally {
        vi.useRealTimers();
      }
    });

    it('maintains a single WebSocket subscription without recreating it on intermediate status updates', async () => {
      vi.mocked(apiClient.createRobotCommand).mockResolvedValueOnce(basePendingCommand);

      const { result } = renderHook(() => useRobotCommand());

      await act(async () => {
        await result.current.sendSetGoal('robot-1', {
          frame_id: 'map',
          position: { x: 1, y: 2, z: 0 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        });
      });

      expect(mockOnMessage).toHaveBeenCalledTimes(1);

      // Intermediate WebSocket update arrives (PENDING -> ACCEPTED)
      emitWsMessage({
        schema_version: 1,
        event_type: 'command.updated',
        robot_id: 'robot-1',
        recorded_at: '2026-09-04T12:00:01Z',
        received_at: '2026-09-04T12:00:01Z',
        payload: {
          ...basePendingCommand,
          status: 'accepted',
          acknowledged_at: '2026-09-04T12:00:01Z',
          updated_at: '2026-09-04T12:00:01Z',
        },
      });

      expect(result.current.lastCommand?.status).toBe('accepted');
      // Subscription must NOT have been torn down and recreated
      expect(mockOnMessage).toHaveBeenCalledTimes(1);
    });
  });
});
