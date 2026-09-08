import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissionStatus } from '../MissionStatus';
import type { Mission } from '../../../types/mission';

describe('MissionStatus Component', () => {
  it('renders truthful "No active mission" state when mission is null', () => {
    render(<MissionStatus mission={null} />);

    expect(screen.getByText('Mission Status')).toBeInTheDocument();
    expect(screen.getByText('No active mission')).toBeInTheDocument();
    expect(
      screen.getByText('No mission is currently executing or scheduled.'),
    ).toBeInTheDocument();
  });

  it('renders mission details with canonical "In Progress" status', () => {
    const mockMission: Mission = {
      id: 'm-123',
      name: 'Autonomous Navigation Beta',
      description: 'Mapping quadrant 4',
      status: 'in_progress',
      startedAt: '2026-09-04T10:00:00Z',
      completedAt: null,
      failureReason: null,
      createdAt: '2026-09-04T09:55:00Z',
      updatedAt: '2026-09-04T10:00:00Z',
    };

    render(<MissionStatus mission={mockMission} />);

    expect(screen.getByText('Autonomous Navigation Beta')).toBeInTheDocument();
    expect(screen.getByText('m-123')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Mapping quadrant 4')).toBeInTheDocument();
  });

  it('renders failure reason when mission has failed status', () => {
    const mockFailedMission: Mission = {
      id: 'm-456',
      name: 'Recovery Route',
      description: null,
      status: 'failed',
      startedAt: '2026-09-04T10:00:00Z',
      completedAt: '2026-09-04T10:05:00Z',
      failureReason: 'Path obstructed by dynamic obstacle',
      createdAt: '2026-09-04T09:55:00Z',
      updatedAt: '2026-09-04T10:05:00Z',
    };

    render(<MissionStatus mission={mockFailedMission} />);

    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/Path obstructed by dynamic obstacle/)).toBeInTheDocument();
  });

  it('renders canonical "Completed" status badge', () => {
    const mockCompleted: Mission = {
      id: 'm-789',
      name: 'Complete Survey',
      description: null,
      status: 'completed',
      startedAt: '2026-09-04T10:00:00Z',
      completedAt: '2026-09-04T10:30:00Z',
      failureReason: null,
      createdAt: '2026-09-04T09:55:00Z',
      updatedAt: '2026-09-04T10:30:00Z',
    };

    render(<MissionStatus mission={mockCompleted} />);
    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1);
  });

  it('renders loading state', () => {
    render(<MissionStatus isLoading={true} />);
    expect(screen.getByText('Loading mission status...')).toBeInTheDocument();
  });

  it('renders canonical "Pending" status badge', () => {
    const mockPending: Mission = {
      id: 'm-pending',
      name: 'Scheduled Perimeter Route',
      description: null,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      failureReason: null,
      createdAt: '2026-09-04T09:55:00Z',
      updatedAt: '2026-09-04T09:55:00Z',
    };

    render(<MissionStatus mission={mockPending} />);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders canonical "Aborted" status badge', () => {
    const mockAborted: Mission = {
      id: 'm-aborted',
      name: 'Emergency Stopped Sweep',
      description: null,
      status: 'aborted',
      startedAt: '2026-09-04T10:00:00Z',
      completedAt: '2026-09-04T10:02:00Z',
      failureReason: null,
      createdAt: '2026-09-04T09:55:00Z',
      updatedAt: '2026-09-04T10:02:00Z',
    };

    render(<MissionStatus mission={mockAborted} />);
    expect(screen.getByText('Aborted')).toBeInTheDocument();
  });
});
