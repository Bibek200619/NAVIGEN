import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OperationalStatus } from '../OperationalStatus';
import type { SafetyEventResponse, LocalizationStatusResponse } from '../../../types/api';

vi.mock('../../../hooks/useSafetyStatus', () => ({
  useSafetyStatus: vi.fn(() => ({
    safetyEvents: [],
    latestEvent: null,
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

describe('OperationalStatus Component', () => {
  it('renders unavailable states when no robot ID or data is present and never defaults to OK', () => {
    render(<OperationalStatus robotId={null} />);

    expect(screen.getByText('Operational Status')).toBeInTheDocument();
    expect(screen.getByText('UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getAllByText('No active robot').length).toBe(2);
  });

  it('renders Safety OK and Localization Tracking correctly', () => {
    const mockSafety: SafetyEventResponse = {
      id: '1',
      robot_id: 'robot-1',
      state: 'ok',
      active_triggers: [],
      description: 'All safety monitors nominal',
      recorded_at: '2026-09-04T12:00:00Z',
      received_at: '2026-09-04T12:00:01Z',
      created_at: '2026-09-04T12:00:01Z',
    };

    const mockLoc: LocalizationStatusResponse = {
      id: '1',
      robot_id: 'robot-1',
      state: 'tracking',
      tracked_features: 512,
      recorded_at: '2026-09-04T12:00:00Z',
      received_at: '2026-09-04T12:00:01Z',
      created_at: '2026-09-04T12:00:01Z',
    };

    render(
      <OperationalStatus
        robotId="robot-1"
        latestSafetyEvent={mockSafety}
        localization={mockLoc}
      />,
    );

    expect(screen.getByText('OK')).toBeInTheDocument();
    expect(screen.getByText('All safety monitors nominal')).toBeInTheDocument();
    expect(screen.getByText('Tracking')).toBeInTheDocument();
    expect(screen.getByTestId('tracked-features-val')).toHaveTextContent('512');
  });

  it('renders Safety WARNING with active triggers', () => {
    const mockSafety: SafetyEventResponse = {
      id: '2',
      robot_id: 'robot-1',
      state: 'warning',
      active_triggers: ['cliff_detected', 'proximity_alert'],
      description: 'Proximity sensor triggered warning',
      recorded_at: '2026-09-04T12:00:00Z',
      received_at: '2026-09-04T12:00:01Z',
      created_at: '2026-09-04T12:00:01Z',
    };

    render(
      <OperationalStatus
        robotId="robot-1"
        latestSafetyEvent={mockSafety}
      />,
    );

    expect(screen.getByText('WARNING')).toBeInTheDocument();
    expect(screen.getByText('cliff_detected')).toBeInTheDocument();
    expect(screen.getByText('proximity_alert')).toBeInTheDocument();
  });

  it('renders Safety EMERGENCY STOP and Localization LOST correctly', () => {
    const mockSafety: SafetyEventResponse = {
      id: '3',
      robot_id: 'robot-1',
      state: 'emergency_stop',
      active_triggers: ['e_stop_button'],
      description: 'Hardware emergency stop engaged',
      recorded_at: '2026-09-04T12:00:00Z',
      received_at: '2026-09-04T12:00:01Z',
      created_at: '2026-09-04T12:00:01Z',
    };

    const mockLoc: LocalizationStatusResponse = {
      id: '2',
      robot_id: 'robot-1',
      state: 'lost',
      tracked_features: 0,
      recorded_at: '2026-09-04T12:00:00Z',
      received_at: '2026-09-04T12:00:01Z',
      created_at: '2026-09-04T12:00:01Z',
    };

    render(
      <OperationalStatus
        robotId="robot-1"
        latestSafetyEvent={mockSafety}
        localization={mockLoc}
      />,
    );

    expect(screen.getByText('EMERGENCY STOP')).toBeInTheDocument();
    expect(screen.getByText('Lost')).toBeInTheDocument();
    expect(screen.getByTestId('tracked-features-val')).toHaveTextContent('0');
  });

  it('renders error messages when safety or localization fetch fails', () => {
    const safetyErr = new Error('Safety service disconnected');
    const locErr = new Error('Localization SLAM node unresponsive');

    render(
      <OperationalStatus
        robotId="robot-1"
        safetyError={safetyErr}
        localizationError={locErr}
      />,
    );

    expect(screen.getByText(/Failed to load safety: Safety service disconnected/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to load localization: Localization SLAM node unresponsive/)).toBeInTheDocument();
  });
});
