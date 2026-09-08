import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissionHistory } from '../MissionHistory';
import type { Mission } from '../../../types/mission';

describe('MissionHistory Component', () => {
  it('renders empty state when no missions are provided', () => {
    render(<MissionHistory missions={[]} />);

    expect(screen.getByText('Mission History')).toBeInTheDocument();
    expect(
      screen.getByText('No past missions recorded for this robot.'),
    ).toBeInTheDocument();
  });

  it('renders real mission list with names and statuses', () => {
    const onSelect = vi.fn();
    const mockMissions: Mission[] = [
      {
        id: 'hist-1',
        name: 'Area Scan Alpha',
        status: 'completed',
        createdAt: '2026-09-04T08:00:00Z',
        completedAt: '2026-09-04T08:30:00Z',
      },
      {
        id: 'hist-2',
        name: 'Waypoint Run Bravo',
        status: 'failed',
        createdAt: '2026-09-04T09:00:00Z',
        completedAt: '2026-09-04T09:10:00Z',
        failureReason: 'Wheel traction slip detected',
      },
    ];

    render(
      <MissionHistory
        missions={mockMissions}
        onSelectMission={onSelect}
        selectedMissionId="hist-1"
      />,
    );

    expect(screen.getByText('Area Scan Alpha')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Waypoint Run Bravo')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText(/Wheel traction slip detected/)).toBeInTheDocument();

    // Click on a mission
    fireEvent.click(screen.getByText('Waypoint Run Bravo'));
    expect(onSelect).toHaveBeenCalledWith(mockMissions[1]);
  });
});
