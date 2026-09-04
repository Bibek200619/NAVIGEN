import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MissionPage } from '../Mission';
import { useRobotData } from '../../../hooks/useRobotData';
import { useMissions } from '../../../hooks/useMissions';
import { useMissionDetail } from '../../../hooks/useMissionDetail';
import { useRobotCommand } from '../../../hooks/useRobotCommand';
import { useTelemetry } from '../../../hooks/useTelemetry';
import { useSafetyStatus } from '../../../hooks/useSafetyStatus';
import type { Robot } from '../../../types/api';
import type { Mission, Goal } from '../../../types/mission';

vi.mock('../../../hooks/useRobotData', () => ({
  useRobotData: vi.fn(),
}));

vi.mock('../../../hooks/useMissions', () => ({
  useMissions: vi.fn(),
}));

vi.mock('../../../hooks/useMissionDetail', () => ({
  useMissionDetail: vi.fn(),
}));

vi.mock('../../../hooks/useRobotCommand', () => ({
  useRobotCommand: vi.fn(),
}));

vi.mock('../../../hooks/useTelemetry', () => ({
  useTelemetry: vi.fn(),
}));

vi.mock('../../../hooks/useSafetyStatus', () => ({
  useSafetyStatus: vi.fn(),
}));

describe('MissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useTelemetry).mockReturnValue({
      telemetry: {
        timestamp: Date.now(),
        isStale: false,
        connectionStatus: 'connected',
        safetyState: 'ok',
      },
      isConnected: true,
      status: 'connected',
    });

    vi.mocked(useSafetyStatus).mockReturnValue({
      safetyEvents: [],
      latestEvent: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders no robot state when there is no active robot selected', () => {
    vi.mocked(useRobotData).mockReturnValue({
      robots: [],
      selectedRobot: null,
      selectedRobotId: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      setSelectedRobot: vi.fn(),
    });

    vi.mocked(useMissions).mockReturnValue({
      missions: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useMissionDetail).mockReturnValue({
      mission: null,
      goals: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useRobotCommand).mockReturnValue({
      lastCommand: null,
      isLoading: false,
      error: null,
      sendSetGoal: vi.fn(),
      sendSoftwareEstop: vi.fn(),
      clearError: vi.fn(),
      reset: vi.fn(),
    });

    render(<MissionPage />);

    expect(screen.getByText('Mission Management')).toBeInTheDocument();
    expect(screen.getByText('No Active Robot')).toBeInTheDocument();
  });

  it('renders active mission, goals, and history when robot and mission data exist', () => {
    const mockRobot: Robot = {
      id: 'robot-alpha',
      name: 'Alpha UGV',
      slug: 'alpha-ugv',
      status: 'navigating',
      connection_status: 'connected',
      last_seen_at: '2026-09-04T12:00:00Z',
      description: null,
      metadata: {},
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
    };

    const mockMission: Mission = {
      id: 'm-active-1',
      robotId: 'robot-alpha',
      name: 'Alpha Route Survey',
      description: 'First field survey',
      status: 'in_progress',
      createdBy: 'user-1',
      startedAt: '2026-09-04T12:00:00Z',
      completedAt: null,
      failureReason: null,
      createdAt: '2026-09-04T11:55:00Z',
      updatedAt: '2026-09-04T12:00:00Z',
    };

    const mockGoals: Goal[] = [
      {
        id: 'g-1',
        missionId: 'm-active-1',
        sequenceNo: 1,
        frameId: 'map',
        position: { x: 10.0, y: 5.0, z: 0.0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        reachedAt: '2026-09-04T12:05:00Z',
        createdAt: '2026-09-04T11:55:00Z',
      },
    ];

    vi.mocked(useRobotData).mockReturnValue({
      robots: [mockRobot],
      selectedRobot: mockRobot,
      selectedRobotId: 'robot-alpha',
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      setSelectedRobot: vi.fn(),
    });

    vi.mocked(useMissions).mockReturnValue({
      missions: [mockMission],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useMissionDetail).mockReturnValue({
      mission: mockMission,
      goals: mockGoals,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useRobotCommand).mockReturnValue({
      lastCommand: null,
      isLoading: false,
      error: null,
      sendSetGoal: vi.fn(),
      sendSoftwareEstop: vi.fn(),
      clearError: vi.fn(),
      reset: vi.fn(),
    });

    render(<MissionPage />);

    expect(screen.getByText('Alpha UGV')).toBeInTheDocument();
    expect(screen.getAllByText('Alpha Route Survey').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('First field survey')).toBeInTheDocument();
    expect(screen.getByText('Mission Goals')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText(/X: 10.00 \| Y: 5.00 \| Z: 0.00/)).toBeInTheDocument();
  });

  it('triggers software E-Stop command from UI and displays feedback banner', async () => {
    const mockRobot: Robot = {
      id: 'robot-alpha',
      name: 'Alpha UGV',
      slug: 'alpha-ugv',
      status: 'navigating',
      connection_status: 'connected',
      last_seen_at: '2026-09-04T12:00:00Z',
      description: null,
      metadata: {},
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
    };

    const sendSoftwareEstop = vi.fn().mockResolvedValue({
      id: 'cmd-estop-99',
      robot_id: 'robot-alpha',
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
    });

    vi.mocked(useRobotData).mockReturnValue({
      robots: [mockRobot],
      selectedRobot: mockRobot,
      selectedRobotId: 'robot-alpha',
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      setSelectedRobot: vi.fn(),
    });

    vi.mocked(useMissions).mockReturnValue({
      missions: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useMissionDetail).mockReturnValue({
      mission: null,
      goals: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    vi.mocked(useRobotCommand).mockReturnValue({
      lastCommand: null,
      isLoading: false,
      error: null,
      sendSetGoal: vi.fn(),
      sendSoftwareEstop,
      clearError: vi.fn(),
      reset: vi.fn(),
    });

    render(<MissionPage />);

    // Click trigger and confirm E-Stop
    fireEvent.click(screen.getByText('Trigger E-Stop'));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Stop' }));

    await waitFor(() => {
      expect(sendSoftwareEstop).toHaveBeenCalledWith('robot-alpha', true, null);
    });

    expect(screen.getByTestId('mission-feedback-banner')).toHaveTextContent(
      'Software E-Stop command dispatched: Status is EXECUTED',
    );
  });

  describe('Safety Gating Integration', () => {
    const baseRobot: Robot = {
      id: 'robot-alpha',
      name: 'Alpha UGV',
      slug: 'alpha-ugv',
      status: 'idle',
      connection_status: 'connected',
      last_seen_at: '2026-09-04T12:00:00Z',
      description: null,
      metadata: {},
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
    };

    const setupMocks = (robotOverrides?: Partial<Robot>) => {
      const mockRobot = { ...baseRobot, ...robotOverrides };
      const sendSetGoal = vi.fn().mockResolvedValue({
        id: 'cmd-goal-1',
        robot_id: 'robot-alpha',
        mission_id: null,
        requested_by: 'user-1',
        command_type: 'set_goal',
        status: 'executed',
        request_payload: {},
        response_payload: null,
        rejection_reason: null,
        failure_reason: null,
        requested_at: '2026-09-04T12:00:00Z',
        acknowledged_at: '2026-09-04T12:00:01Z',
        executed_at: '2026-09-04T12:00:02Z',
        created_at: '2026-09-04T12:00:00Z',
        updated_at: '2026-09-04T12:00:02Z',
      });
      const sendSoftwareEstop = vi.fn().mockResolvedValue({
        id: 'cmd-estop-1',
        robot_id: 'robot-alpha',
        mission_id: null,
        requested_by: 'user-1',
        command_type: 'software_estop',
        status: 'executed',
        request_payload: {},
        response_payload: null,
        rejection_reason: null,
        failure_reason: null,
        requested_at: '2026-09-04T12:00:00Z',
        acknowledged_at: '2026-09-04T12:00:01Z',
        executed_at: '2026-09-04T12:00:02Z',
        created_at: '2026-09-04T12:00:00Z',
        updated_at: '2026-09-04T12:00:02Z',
      });

      vi.mocked(useRobotData).mockReturnValue({
        robots: [mockRobot],
        selectedRobot: mockRobot,
        selectedRobotId: mockRobot.id,
        isLoading: false,
        error: null,
        refetch: vi.fn(),
        setSelectedRobot: vi.fn(),
      });

      vi.mocked(useMissions).mockReturnValue({
        missions: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      vi.mocked(useMissionDetail).mockReturnValue({
        mission: null,
        goals: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      vi.mocked(useRobotCommand).mockReturnValue({
        lastCommand: null,
        isLoading: false,
        error: null,
        sendSetGoal,
        sendSoftwareEstop,
        clearError: vi.fn(),
        reset: vi.fn(),
      });

      return { mockRobot, sendSetGoal, sendSoftwareEstop };
    };

    it('healthy connected robot: enables goal dispatch and E-Stop with no safety warning banner', async () => {
      const { sendSetGoal } = setupMocks();

      render(<MissionPage />);

      expect(screen.queryByTestId('safety-lockout-banner')).not.toBeInTheDocument();

      const dispatchBtn = screen.getByRole('button', { name: 'Dispatch Goal' });
      expect(dispatchBtn).not.toBeDisabled();

      const estopBtn = screen.getByRole('button', { name: 'Trigger E-Stop' });
      expect(estopBtn).not.toBeDisabled();

      fireEvent.click(dispatchBtn);

      await waitFor(() => {
        expect(sendSetGoal).toHaveBeenCalledWith(
          'robot-alpha',
          {
            frame_id: 'map',
            position: { x: 0, y: 0, z: 0 },
            orientation: { x: 0, y: 0, z: 0, w: 1 },
          },
          null,
        );
      });
    });

    it('stale telemetry: locks goal dispatch, displays stale banner, and keeps E-Stop enabled', async () => {
      const { sendSoftwareEstop } = setupMocks();

      vi.mocked(useTelemetry).mockReturnValue({
        telemetry: {
          timestamp: Date.now(),
          isStale: true,
          connectionStatus: 'connected',
          safetyState: 'ok',
        },
        isConnected: true,
        status: 'connected',
      });

      render(<MissionPage />);

      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Telemetry stream is stale.');

      const dispatchBtn = screen.getByRole('button', { name: 'Dispatch Goal' });
      expect(dispatchBtn).toBeDisabled();

      expect(screen.getByLabelText(/X \(m\)/)).toBeDisabled();
      expect(screen.getByLabelText(/Y \(m\)/)).toBeDisabled();

      // E-Stop must remain triggerable
      const estopBtn = screen.getByRole('button', { name: 'Trigger E-Stop' });
      expect(estopBtn).not.toBeDisabled();

      fireEvent.click(estopBtn);
      fireEvent.click(screen.getByRole('button', { name: 'Confirm Stop' }));

      await waitFor(() => {
        expect(sendSoftwareEstop).toHaveBeenCalledWith('robot-alpha', true, null);
      });
    });

    it('disconnected robot: locks goal dispatch and disables E-Stop', () => {
      setupMocks({ connection_status: 'disconnected' });

      vi.mocked(useTelemetry).mockReturnValue({
        telemetry: {
          timestamp: Date.now(),
          isStale: false,
          connectionStatus: 'disconnected',
        },
        isConnected: false,
        status: 'disconnected',
      });

      render(<MissionPage />);

      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Robot is disconnected.');

      expect(screen.getByRole('button', { name: 'Dispatch Goal' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Trigger E-Stop' })).toBeDisabled();
    });

    it('emergency stop state via telemetry: locks goal dispatch, preserves E-Stop', () => {
      setupMocks();

      vi.mocked(useTelemetry).mockReturnValue({
        telemetry: {
          timestamp: Date.now(),
          isStale: false,
          connectionStatus: 'connected',
          safetyState: 'emergency_stop',
        },
        isConnected: true,
        status: 'connected',
      });

      render(<MissionPage />);

      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Robot is in emergency stop.');

      expect(screen.getByRole('button', { name: 'Dispatch Goal' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Trigger E-Stop' })).not.toBeDisabled();
    });

    it('emergency stop state via useSafetyStatus: locks goal dispatch, preserves E-Stop', () => {
      setupMocks();

      vi.mocked(useSafetyStatus).mockReturnValue({
        safetyEvents: [],
        latestEvent: {
          id: 'evt-safety-1',
          robot_id: 'robot-alpha',
          state: 'emergency_stop',
          active_triggers: ['obstacle_hazard'],
          description: 'Obstacle collision threshold triggered',
          recorded_at: '2026-09-04T12:00:00Z',
          received_at: '2026-09-04T12:00:00Z',
          created_at: '2026-09-04T12:00:00Z',
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(<MissionPage />);

      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Robot is in emergency stop.');

      expect(screen.getByRole('button', { name: 'Dispatch Goal' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Trigger E-Stop' })).not.toBeDisabled();
    });

    it('robot error state: locks goal dispatch, preserves E-Stop', () => {
      setupMocks({ status: 'error' });

      render(<MissionPage />);

      const banner = screen.getByTestId('safety-lockout-banner');
      expect(banner).toHaveTextContent('Motion commands disabled: Robot is reporting an error.');

      expect(screen.getByRole('button', { name: 'Dispatch Goal' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Trigger E-Stop' })).not.toBeDisabled();
    });

    it('deterministic priority ordering: disconnected > emergency stop > robot error > stale telemetry', () => {
      // 1. Disconnected AND Stale -> Disconnected takes priority
      setupMocks({ connection_status: 'disconnected' });
      vi.mocked(useTelemetry).mockReturnValue({
        telemetry: {
          timestamp: Date.now(),
          isStale: true,
          connectionStatus: 'disconnected',
        },
        isConnected: false,
        status: 'disconnected',
      });

      const { unmount } = render(<MissionPage />);
      expect(screen.getByTestId('safety-lockout-banner')).toHaveTextContent(
        'Motion commands disabled: Robot is disconnected.',
      );
      unmount();

      // 2. Connected, Emergency Stop AND Error AND Stale -> Emergency Stop takes priority
      setupMocks({ status: 'error', connection_status: 'connected' });
      vi.mocked(useTelemetry).mockReturnValue({
        telemetry: {
          timestamp: Date.now(),
          isStale: true,
          connectionStatus: 'connected',
          safetyState: 'emergency_stop',
        },
        isConnected: true,
        status: 'connected',
      });

      const { unmount: unmount2 } = render(<MissionPage />);
      expect(screen.getByTestId('safety-lockout-banner')).toHaveTextContent(
        'Motion commands disabled: Robot is in emergency stop.',
      );
      unmount2();

      // 3. Connected, Error AND Stale -> Robot Error takes priority
      setupMocks({ status: 'error', connection_status: 'connected' });
      vi.mocked(useTelemetry).mockReturnValue({
        telemetry: {
          timestamp: Date.now(),
          isStale: true,
          connectionStatus: 'connected',
          safetyState: 'ok',
        },
        isConnected: true,
        status: 'connected',
      });

      render(<MissionPage />);
      expect(screen.getByTestId('safety-lockout-banner')).toHaveTextContent(
        'Motion commands disabled: Robot is reporting an error.',
      );
    });
  });
});
