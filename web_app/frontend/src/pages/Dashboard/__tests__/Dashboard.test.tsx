import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DashboardPage } from '../Dashboard';

const mockRefetch = vi.fn();

vi.mock('../../../hooks/useRobotData', () => ({
  useRobotData: vi.fn(() => ({
    robots: [],
    selectedRobot: { id: 'ugv-01-uuid', name: 'Vanguard Alpha', status: 'navigating', connection_status: 'connected' },
    selectedRobotId: 'ugv-01-uuid',
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  })),
}));
vi.mock('../../../hooks/useRobot', () => ({ useRobot: vi.fn(() => ({ robotState: null, connectionStatus: 'connected', isConnected: true })) }));
vi.mock('../../../hooks/useSafetyStatus', () => ({ useSafetyStatus: vi.fn(() => ({ latestEvent: { state: 'ok' }, safetyEvents: [], isLoading: false, error: null, refetch: vi.fn() })) }));
vi.mock('../../../hooks/useLocalizationStatus', () => ({ useLocalizationStatus: vi.fn(() => ({ localization: null, isLoading: false, error: null, refetch: vi.fn() })) }));
vi.mock('../../../hooks/useTelemetry', () => ({ useTelemetry: vi.fn(() => ({ telemetry: null, status: 'connected', isConnected: true })) }));
vi.mock('../../../hooks/useTelemetryHistory', () => ({ useTelemetryHistory: vi.fn(() => ({ history: [], isLoading: false, error: null, refetch: vi.fn() })) }));
vi.mock('../../../hooks/useSensorStatus', () => ({ useSensorStatus: vi.fn(() => ({ sensors: [], isLoading: false, error: null, refetch: vi.fn() })) }));

describe('DashboardPage', () => {
  it('renders the tactical command station', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('UGV Command Station')).toBeInTheDocument();
    expect(screen.getAllByText('Vanguard Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SAFETY: NOMINAL')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Robot State' })).toBeInTheDocument();
  });

  it('refreshes robot state', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    screen.getByRole('button', { name: 'Refresh Robot State' }).click();
    expect(mockRefetch).toHaveBeenCalled();
  });
});
