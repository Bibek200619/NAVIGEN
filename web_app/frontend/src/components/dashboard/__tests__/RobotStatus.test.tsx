import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RobotStatus } from '../RobotStatus';
import type { Robot } from '../../../types/api';
import type { UseRobotReturn } from '../../../hooks/useRobot';

vi.mock('../../../hooks/useRobot', () => ({
  useRobot: vi.fn(),
}));

// Mock useRobotData so testing RobotStatus with direct props or hook fallback works predictably
vi.mock('../../../hooks/useRobotData', () => ({
  useRobotData: vi.fn(() => ({
    robots: [],
    selectedRobot: null,
    selectedRobotId: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    setSelectedRobot: vi.fn(),
  })),
}));

import { useRobot } from '../../../hooks/useRobot';

const mockUseRobot = vi.mocked(useRobot);

function defaultWsRobotReturn(overrides: Partial<UseRobotReturn> = {}): UseRobotReturn {
  return {
    robotState: null,
    connectionStatus: 'disconnected',
    isConnected: false,
    ...overrides,
  };
}

describe('RobotStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseRobot.mockReturnValue(defaultWsRobotReturn());
  });

  it('renders loading state when isLoading is true', () => {
    render(<RobotStatus isLoading={true} />);

    expect(screen.getByText('Loading robot metadata...')).toBeInTheDocument();
  });

  it('renders error state when error is provided', () => {
    render(<RobotStatus isLoading={false} error={new Error('Database unavailable')} />);

    expect(screen.getByText('Failed to load robot')).toBeInTheDocument();
    expect(screen.getByText('Database unavailable')).toBeInTheDocument();
  });

  it('renders no robot state when robot is null and not loading', () => {
    render(<RobotStatus isLoading={false} robot={null} />);

    expect(screen.getByText('No robot registered')).toBeInTheDocument();
  });

  it('renders real robot data when robot is present', () => {
    const mockRobot: Robot = {
      id: 'robot-uuid-abc-123',
      name: 'UGV Vanguard 01',
      slug: 'vanguard-01',
      status: 'navigating',
      connection_status: 'connected',
      last_seen_at: '2026-09-04T12:30:00Z',
      description: 'Tactical survey vehicle',
      metadata: {},
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-04T12:30:00Z',
    };

    render(<RobotStatus isLoading={false} robot={mockRobot} />);

    expect(screen.getByText('UGV Vanguard 01')).toBeInTheDocument();
    expect(screen.getByText('robot-uuid-abc-123')).toBeInTheDocument();
    expect(screen.getByText('Navigating')).toBeInTheDocument();
    expect(screen.getAllByText('Connected').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tactical survey vehicle')).toBeInTheDocument();
  });

  it('exercises full stream lifecycle transitions: connected -> stale -> reconnecting -> disconnected -> live again', () => {
    const baseRobot: Robot = {
      id: 'robot-uuid-abc-123',
      name: 'UGV Vanguard 01',
      slug: 'vanguard-01',
      status: 'navigating',
      connection_status: 'connected',
      last_seen_at: '2026-09-04T12:30:00Z',
      description: 'Tactical survey vehicle',
      metadata: {},
      created_at: '2026-09-01T00:00:00Z',
      updated_at: '2026-09-04T12:30:00Z',
    };

    // 1. Gateway & link connected + live telemetry
    mockUseRobot.mockReturnValue(
      defaultWsRobotReturn({
        connectionStatus: 'connected',
        isConnected: true,
        robotState: {
          id: 'robot-uuid-abc-123',
          connectionStatus: 'connected',
          isStale: false,
          velocity: { linear: 1.45, angular: 0.35 },
        },
      }),
    );

    const { rerender } = render(<RobotStatus isLoading={false} robot={baseRobot} />);

    expect(within(screen.getByText('Gateway:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot link:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot status:').parentElement!).getByText('Navigating')).toBeInTheDocument();
    expect(within(screen.getByText('Telemetry:').parentElement!).getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('1.45')).toBeInTheDocument();
    expect(screen.getByText('0.35')).toBeInTheDocument();

    // 2. Telemetry stream becomes stale (link remains connected)
    mockUseRobot.mockReturnValue(
      defaultWsRobotReturn({
        connectionStatus: 'connected',
        isConnected: true,
        robotState: {
          id: 'robot-uuid-abc-123',
          connectionStatus: 'connected',
          isStale: true,
          velocity: { linear: 1.45, angular: 0.35 },
        },
      }),
    );
    rerender(<RobotStatus isLoading={false} robot={baseRobot} />);

    expect(within(screen.getByText('Gateway:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot link:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Telemetry:').parentElement!).getByText('Stale')).toBeInTheDocument();

    // 3. Reconnecting state (gateway disconnects and attempts to reconnect)
    mockUseRobot.mockReturnValue(
      defaultWsRobotReturn({
        connectionStatus: 'reconnecting',
        isConnected: false,
        robotState: {
          id: 'robot-uuid-abc-123',
          connectionStatus: 'disconnected',
          isStale: true,
          velocity: undefined,
        },
      }),
    );
    rerender(
      <RobotStatus
        isLoading={false}
        robot={{ ...baseRobot, connection_status: 'disconnected' }}
      />,
    );

    expect(within(screen.getByText('Gateway:').parentElement!).getByText('Reconnecting')).toBeInTheDocument();
    expect(within(screen.getByText('Robot link:').parentElement!).getByText('Disconnected')).toBeInTheDocument();
    expect(within(screen.getByText('Telemetry:').parentElement!).getByText('Stale')).toBeInTheDocument();
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);

    // 4. Disconnected / offline state
    mockUseRobot.mockReturnValue(
      defaultWsRobotReturn({
        connectionStatus: 'disconnected',
        isConnected: false,
        robotState: null,
      }),
    );
    rerender(
      <RobotStatus
        isLoading={false}
        robot={{ ...baseRobot, connection_status: 'disconnected', status: 'offline' }}
      />,
    );

    expect(within(screen.getByText('Gateway:').parentElement!).getByText('Disconnected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot link:').parentElement!).getByText('Disconnected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot status:').parentElement!).getByText('Offline')).toBeInTheDocument();
    expect(within(screen.getByText('Telemetry:').parentElement!).getByText('Unavailable')).toBeInTheDocument();

    // 5. Connection restored / live again
    mockUseRobot.mockReturnValue(
      defaultWsRobotReturn({
        connectionStatus: 'connected',
        isConnected: true,
        robotState: {
          id: 'robot-uuid-abc-123',
          connectionStatus: 'connected',
          isStale: false,
          velocity: { linear: 0.82, angular: -0.18 },
        },
      }),
    );
    rerender(
      <RobotStatus
        isLoading={false}
        robot={{ ...baseRobot, connection_status: 'connected', status: 'navigating' }}
      />,
    );

    expect(within(screen.getByText('Gateway:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot link:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot status:').parentElement!).getByText('Navigating')).toBeInTheDocument();
    expect(within(screen.getByText('Telemetry:').parentElement!).getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('0.82')).toBeInTheDocument();
    expect(screen.getByText('-0.18')).toBeInTheDocument();
  });

  it('updates telemetry and status correctly when robot prop is omitted and driven by WebSocket robotState', () => {
    mockUseRobot.mockReturnValue(
      defaultWsRobotReturn({
        connectionStatus: 'connected',
        isConnected: true,
        robotState: {
          id: 'robot-uuid-fallback',
          status: 'idle',
          connectionStatus: 'connected',
          isStale: false,
          velocity: { linear: 0.0, angular: 0.0 },
        },
      }),
    );

    render(<RobotStatus isLoading={false} robot={null} />);

    expect(screen.getByText('No robot registered')).toBeInTheDocument();
    expect(within(screen.getByText('Gateway:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Robot link:').parentElement!).getByText('Connected')).toBeInTheDocument();
    expect(within(screen.getByText('Telemetry:').parentElement!).getByText('Live')).toBeInTheDocument();
  });
});
