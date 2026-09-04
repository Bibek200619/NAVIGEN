import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MissionPage } from '../Mission';
import { useRobotData } from '../../../hooks/useRobotData';
import { useMissions } from '../../../hooks/useMissions';
import { useMissionDetail } from '../../../hooks/useMissionDetail';
import { useRobotCommand } from '../../../hooks/useRobotCommand';
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

describe('MissionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
