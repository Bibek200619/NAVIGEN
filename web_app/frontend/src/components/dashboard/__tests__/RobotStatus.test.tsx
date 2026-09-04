import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
});
