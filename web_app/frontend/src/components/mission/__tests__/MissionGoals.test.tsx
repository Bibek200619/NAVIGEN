import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MissionGoals } from '../MissionGoals';
import type { Goal } from '../../../types/mission';

describe('MissionGoals Component', () => {
  it('renders loading state', () => {
    render(<MissionGoals isLoading={true} />);
    expect(screen.getByText('Loading mission goals...')).toBeInTheDocument();
  });

  it('renders truthful empty state when no goals defined', () => {
    render(<MissionGoals goals={[]} />);
    expect(screen.getByText('Mission Goals')).toBeInTheDocument();
    expect(screen.getByText('No goals defined')).toBeInTheDocument();
    expect(screen.getByText('No goals defined for this mission.')).toBeInTheDocument();
  });

  it('renders goal cards with technical coordinates, sequences, and reached status', () => {
    const mockGoals: Goal[] = [
      {
        id: 'g-01',
        missionId: 'm-100',
        sequenceNo: 1,
        frameId: 'map',
        position: { x: 12.4, y: -4.2, z: 0.0 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        reachedAt: '2026-09-04T12:10:00Z',
        createdAt: '2026-09-04T12:00:00Z',
      },
      {
        id: 'g-02',
        missionId: 'm-100',
        sequenceNo: 2,
        frameId: 'odom',
        position: { x: 25.0, y: 15.5, z: 1.2 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
        reachedAt: null,
        createdAt: '2026-09-04T12:00:00Z',
      },
    ];

    render(<MissionGoals goals={mockGoals} />);

    // Sequence checks
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('GOAL 01')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
    expect(screen.getByText('GOAL 02')).toBeInTheDocument();

    // Coordinate strings and breakdown
    expect(screen.getByText(/X: 12.40 \| Y: -4.20 \| Z: 0.00/)).toBeInTheDocument();
    expect(screen.getByText('12.40 m')).toBeInTheDocument();
    expect(screen.getByText('-4.20 m')).toBeInTheDocument();
    expect(screen.getByText('25.00 m')).toBeInTheDocument();

    // Frames
    expect(screen.getByText('map')).toBeInTheDocument();
    expect(screen.getByText('odom')).toBeInTheDocument();

    // Reached vs Pending badges
    expect(screen.getByText('Reached')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});
