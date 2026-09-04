import { useState, useCallback } from 'react';
import { apiClient, ApiError } from '../services/api';
import type {
  CommandResponse,
  SetGoalPayload,
  SoftwareEstopPayload,
  CommandCreate,
} from '../types/api';

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
}

/**
 * Hook to dispatch navigation goals and software E-Stop commands to a robot.
 * Translates HTTP 401/403 status codes into clear operator permission messages.
 */
export const useRobotCommand = (): UseRobotCommandReturn => {
  const [lastCommand, setLastCommand] = useState<CommandResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const clearError = useCallback(() => setError(null), []);
  const reset = useCallback(() => {
    setLastCommand(null);
    setIsLoading(false);
    setError(null);
  }, []);

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
  };
};
