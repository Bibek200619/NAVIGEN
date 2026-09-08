import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DashboardPage } from '../Dashboard';

const mockRefetch = vi.fn();

vi.mock('../../../hooks/useRobotData', () => ({
  useRobotData: vi.fn(() => ({
    robots: [],
    selectedRobot: {
      id: 'ugv-01-uuid',
      name: 'Vanguard Alpha',
      status: 'navigating',
      connection_status: 'connected',
    },
    selectedRobotId: 'ugv-01-uuid',
    isLoading: false,
    error: null,
    refetch: mockRefetch,
  })),
}));

vi.mock('../../../hooks/useRobot', () => ({
  useRobot: vi.fn(() => ({
    robotState: null,
    connectionStatus: 'connected',
    isConnected: true,
  })),
}));

vi.mock('../../../hooks/useSafetyStatus', () => ({
  useSafetyStatus: vi.fn(() => ({
    safetyEvents: [],
    latestEvent: { state: 'ok' },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useLocalizationStatus', () => ({
  useLocalizationStatus: vi.fn(() => ({
    localization: null,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useTelemetry', () => ({
  useTelemetry: vi.fn(() => ({
    telemetry: null,
    status: 'connected',
    isConnected: true,
  })),
}));

vi.mock('../../../hooks/useTelemetryHistory', () => ({
  useTelemetryHistory: vi.fn(() => ({
    history: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock('../../../hooks/useSensorStatus', () => ({
  useSensorStatus: vi.fn(() => ({
    sensors: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

describe('DashboardPage', () => {
  it('renders tactical command station header with active robot and quick status badges', () => {
    render(<DashboardPage />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('UGV Command Station')).toBeInTheDocument();
    expect(screen.getAllByText('Vanguard Alpha').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('(ugv-01-uuid)')).toBeInTheDocument();
    expect(screen.getByText('SAFETY: NOMINAL')).toBeInTheDocument();

    // Verify all 6 dashboard sections are rendered
    expect(screen.getByText('Live Map')).toBeInTheDocument();
    expect(screen.getByText('Camera Preview')).toBeInTheDocument();
    expect(screen.getByText('Robot Status')).toBeInTheDocument();
    expect(screen.getByText('Telemetry')).toBeInTheDocument();
    expect(screen.getByText('Operational Status')).toBeInTheDocument();
    expect(screen.getByText('Sensor Health')).toBeInTheDocument();
  });

  it('triggers robot refetch when refresh button is clicked', () => {
    render(<DashboardPage />);

    const refreshBtn = screen.getByRole('button', { name: 'Refresh Robot State' });
    expect(refreshBtn).toBeInTheDocument();

    fireEvent.click(refreshBtn);
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});
