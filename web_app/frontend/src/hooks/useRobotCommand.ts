import { useState, useCallback, useEffect, useRef } from 'react';
import { apiClient, ApiError } from '../services/api';
import { wsService } from '../services/websocket';
import type {
  CommandResponse,
  CommandStatus,
  SetGoalPayload,
  SoftwareEstopPayload,
  CommandCreate,
} from '../types/api';

export interface UseRobotCommandOptions {
  reconciliationIntervalMs?: number;
}

export interface UseRobotCommandReturn {
  lastCommand: CommandResponse | null;
  isLoading: boolean;
  error: Error | null;
  sendSetGoal: (
    robotId: string,
    payload: SetGoalPayload,
    missionId?: string | null,
  ) => Promise<CommandResponse>;
  sendSoftwareEstop: (
    robotId: string,
    active: boolean,
    missionId?: string | null,
  ) => Promise<CommandResponse>;
  clearError: () => void;
  reset: () => void;
  reconcile?: () => Promise<CommandResponse | null>;
}

const STATUS_RANK: Record<CommandStatus, number> = {
  pending: 0,
  accepted: 1,
  executed: 2,
  rejected: 2,
  failed: 2,
};

export const isTerminalStatus = (status: CommandStatus): boolean => {
  return status === 'executed' || status === 'rejected' || status === 'failed';
};

/**
 * Determines whether an incoming command update is newer than the current state,
 * preventing stale out-of-order REST responses from overwriting newer WebSocket states.
 */
export const isNewerCommand = (
  current: CommandResponse,
  incoming: CommandResponse,
): boolean => {
  const currentRank = STATUS_RANK[current.status] ?? 0;
  const incomingRank = STATUS_RANK[incoming.status] ?? 0;

  if (incomingRank > currentRank) {
    return true;
  }

  if (incomingRank < currentRank) {
    return false;
  }

  const currentTime = current.updated_at ? Date.parse(current.updated_at) : 0;
  const incomingTime = incoming.updated_at ? Date.parse(incoming.updated_at) : 0;

  if (!isNaN(currentTime) && !isNaN(incomingTime) && incomingTime !== 0 && currentTime !== 0) {
    return incomingTime >= currentTime;
  }

  return true;
};

/**
 * Hook to dispatch navigation goals and software E-Stop commands to a robot.
 * Tracks live command lifecycle updates via WebSocket ('command.updated')
 * and provides fallback reconciliation via GET /commands/{command_id}.
 * Translates HTTP 401/403 status codes into clear operator permission messages.
 */
export const useRobotCommand = (
  options: UseRobotCommandOptions = {},
): UseRobotCommandReturn => {
  const [lastCommand, setLastCommand] = useState<CommandResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const lastCommandRef = useRef<CommandResponse | null>(lastCommand);
  useEffect(() => {
    lastCommandRef.current = lastCommand;
  }, [lastCommand]);

  const clearError = useCallback(() => setError(null), []);
  const reset = useCallback(() => {
    setLastCommand(null);
    setIsLoading(false);
    setError(null);
  }, []);

  const reconcile = useCallback(async (): Promise<CommandResponse | null> => {
    const current = lastCommandRef.current;
    if (!current) return null;
    try {
      const updated = await apiClient.getCommand(current.id);
      if (updated && updated.id === current.id) {
        if (!isNewerCommand(current, updated)) {
          return current;
        }
        setLastCommand(updated);
        return updated;
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const targetCommandId = lastCommand?.id;

  // Live WebSocket command lifecycle tracking & reconciliation
  // Keyed on targetCommandId so intermediate status updates do not recreate subscription/polling
  useEffect(() => {
    if (
      !targetCommandId ||
      (lastCommandRef.current && isTerminalStatus(lastCommandRef.current.status))
    ) {
      return;
    }

    let isCleanedUp = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    // Ensure WebSocket is connected for live updates
    wsService.connect();

    // Subscribe to live command.updated events matched strictly by command ID
    const unsubscribeWs = wsService.onMessage<CommandResponse>((envelope) => {
      if (isCleanedUp) return;

      if (
        envelope.event_type === 'command.updated' &&
        envelope.payload &&
        envelope.payload.id === targetCommandId
      ) {
        const incoming = envelope.payload;
        const current = lastCommandRef.current;
        if (current && !isNewerCommand(current, incoming)) {
          return;
        }

        setLastCommand(incoming);

        // Terminal event arrived: stop polling and release WebSocket listener
        if (isTerminalStatus(incoming.status)) {
          if (pollTimer !== null) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          unsubscribeWs();
        }
      }
    });

    // Fallback reconciliation mechanism: periodic GET /commands/{command_id}
    const intervalMs = options.reconciliationIntervalMs ?? 2000;

    if (intervalMs > 0) {
      pollTimer = setInterval(async () => {
        if (isCleanedUp) return;

        if (lastCommandRef.current && isTerminalStatus(lastCommandRef.current.status)) {
          if (pollTimer !== null) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          unsubscribeWs();
          return;
        }

        try {
          const updated = await apiClient.getCommand(targetCommandId);
          if (isCleanedUp) return;

          if (updated && updated.id === targetCommandId) {
            const current = lastCommandRef.current;
            if (current && !isNewerCommand(current, updated)) {
              return;
            }

            setLastCommand(updated);

            if (isTerminalStatus(updated.status)) {
              if (pollTimer !== null) {
                clearInterval(pollTimer);
                pollTimer = null;
              }
              unsubscribeWs();
            }
          }
        } catch {
          // Silently ignore transient network errors during fallback polling
        }
      }, intervalMs);
    }

    return () => {
      isCleanedUp = true;
      unsubscribeWs();
      if (pollTimer !== null) {
        clearInterval(pollTimer);
      }
    };
  }, [targetCommandId, options.reconciliationIntervalMs]);

  const dispatchCommand = useCallback(
    async (robotId: string, command: CommandCreate): Promise<CommandResponse> => {
      if (!robotId || !robotId.trim()) {
        const guardError = new Error('Cannot send command without an active robot ID.');
        setError(guardError);
        throw guardError;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiClient.createRobotCommand(robotId, command);
        setLastCommand(response);
        return response;
      } catch (err: unknown) {
        let userFacingError: Error;

        if (err instanceof ApiError) {
          if (err.status === 401) {
            userFacingError = new Error('Authentication required / session unavailable');
          } else if (err.status === 403) {
            userFacingError = new Error('Operator permission required for this action');
          } else {
            userFacingError = err;
          }
        } else if (err instanceof Error) {
          userFacingError = err;
        } else {
          userFacingError = new Error(String(err));
        }

        setError(userFacingError);
        throw userFacingError;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const sendSetGoal = useCallback(
    async (
      robotId: string,
      payload: SetGoalPayload,
      missionId?: string | null,
    ): Promise<CommandResponse> => {
      return dispatchCommand(robotId, {
        mission_id: missionId ?? null,
        command_type: 'set_goal',
        payload,
      });
    },
    [dispatchCommand],
  );

  const sendSoftwareEstop = useCallback(
    async (
      robotId: string,
      active: boolean,
      missionId?: string | null,
    ): Promise<CommandResponse> => {
      const payload: SoftwareEstopPayload = { active };
      return dispatchCommand(robotId, {
        mission_id: missionId ?? null,
        command_type: 'software_estop',
        payload,
      });
    },
    [dispatchCommand],
  );

  return {
    lastCommand,
    isLoading,
    error,
    sendSetGoal,
    sendSoftwareEstop,
    clearError,
    reset,
    reconcile,
  };
};
