import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RobotOverview } from '../RobotOverview';
import type { UseRobotReturn } from '../../../hooks/useRobot';

/* ------------------------------------------------------------------ */
/* Mock useRobot                                                       */
/* ------------------------------------------------------------------ */

const mockUseRobot = vi.fn<() => UseRobotReturn>();

vi.mock('../../../hooks/useRobot', () => ({
  useRobot: () => mockUseRobot(),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function defaultRobotReturn(
  overrides: Partial<UseRobotReturn> = {},
): UseRobotReturn {
  return {
    robotState: null,
    connectionStatus: 'disconnected',
    isConnected: false,
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('RobotOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when robotState is null', () => {
    mockUseRobot.mockReturnValue(defaultRobotReturn());

    render(<RobotOverview />);

    expect(screen.getByText('No robot telemetry')).toBeInTheDocument();
  });

  it('renders live robot ID', () => {
    mockUseRobot.mockReturnValue(
      defaultRobotReturn({
        robotState: { id: 'ugv-01' },
        connectionStatus: 'connected',
        isConnected: true,
      }),
    );

    render(<RobotOverview />);

    expect(screen.getByText('ugv-01')).toBeInTheDocument();
  });

  it('shows Connected gateway badge when WebSocket is connected', () => {
    mockUseRobot.mockReturnValue(
      defaultRobotReturn({
        robotState: { id: 'ugv-01' },
        connectionStatus: 'connected',
        isConnected: true,
      }),
    );

    render(<RobotOverview />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows Offline gateway badge when WebSocket is disconnected', () => {
    mockUseRobot.mockReturnValue(defaultRobotReturn());

    render(<RobotOverview />);

    expect(screen.getByText('Offline')).toBeInTheDocument();
  });

  it('shows Status unavailable when robot status is not supplied', () => {
    mockUseRobot.mockReturnValue(
      defaultRobotReturn({
        robotState: { id: 'ugv-01' },
        connectionStatus: 'connected',
        isConnected: true,
      }),
    );

    render(<RobotOverview />);

    // "Status unavailable" appears in both the StatusBadge and the content area —
    // this is correct production behavior for a robot with no status field.
    const matches = screen.getAllByText('Status unavailable');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Reconnecting gateway badge when reconnecting', () => {
    mockUseRobot.mockReturnValue(
      defaultRobotReturn({ connectionStatus: 'reconnecting' }),
    );

    render(<RobotOverview />);

    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });
});
