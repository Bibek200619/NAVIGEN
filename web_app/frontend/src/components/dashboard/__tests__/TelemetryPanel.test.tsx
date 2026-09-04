import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TelemetryPanel } from '../TelemetryPanel';
import type { UseTelemetryReturn } from '../../../hooks/useTelemetry';
import type { UseTelemetryHistoryReturn } from '../../../hooks/useTelemetryHistory';

vi.mock('../../../hooks/useTelemetry', () => ({
  useTelemetry: vi.fn(),
}));

vi.mock('../../../hooks/useTelemetryHistory', () => ({
  useTelemetryHistory: vi.fn(),
}));

import { useTelemetry } from '../../../hooks/useTelemetry';
import { useTelemetryHistory } from '../../../hooks/useTelemetryHistory';

const mockUseTelemetry = vi.mocked(useTelemetry);
const mockUseTelemetryHistory = vi.mocked(useTelemetryHistory);

function defaultWsTelemetryReturn(overrides: Partial<UseTelemetryReturn> = {}): UseTelemetryReturn {
  return {
    telemetry: null,
    status: 'disconnected',
    isConnected: false,
    ...overrides,
  };
}

function defaultHistoryReturn(overrides: Partial<UseTelemetryHistoryReturn> = {}): UseTelemetryHistoryReturn {
  return {
    history: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe('TelemetryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTelemetry.mockReturnValue(defaultWsTelemetryReturn());
    mockUseTelemetryHistory.mockReturnValue(defaultHistoryReturn());
  });

  it('renders real live telemetry values when present', () => {
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 92.4,
          linearVelocity: 0.85,
          angularVelocity: 0.12,
          isStale: false,
          positionX: 10.5,
          positionY: -4.2,
          positionZ: 0.0,
          yaw: 1.57,
        },
        status: 'connected',
        isConnected: true,
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('92.4%')).toBeInTheDocument();
    expect(screen.getByText('0.85')).toBeInTheDocument();
    expect(screen.getByText('0.12')).toBeInTheDocument();
    expect(screen.getByText('10.50m')).toBeInTheDocument();
    expect(screen.getByText('-4.20m')).toBeInTheDocument();
    expect(screen.getByText('0.00m')).toBeInTheDocument();
    expect(screen.getByText('1.57')).toBeInTheDocument();
  });

  it('renders stale telemetry state properly', () => {
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        telemetry: {
          timestamp: 1700000000000,
          linearVelocity: 0.0,
          isStale: true,
        },
        status: 'connected',
        isConnected: true,
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('Stale')).toBeInTheDocument();
    expect(screen.getByText('State: Stale')).toBeInTheDocument();
  });

  it('renders history empty state when no historical samples exist', () => {
    mockUseTelemetryHistory.mockReturnValue(
      defaultHistoryReturn({
        history: [],
        isLoading: false,
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    expect(screen.getByText('No telemetry history available')).toBeInTheDocument();
  });

  it('renders localized history error without crashing live telemetry', () => {
    mockUseTelemetry.mockReturnValue(
      defaultWsTelemetryReturn({
        telemetry: {
          timestamp: 1700000000000,
          batteryLevel: 75.0,
          linearVelocity: 0.5,
        },
        status: 'connected',
        isConnected: true,
      }),
    );

    mockUseTelemetryHistory.mockReturnValue(
      defaultHistoryReturn({
        history: [],
        error: new Error('Unauthorized telemetry query'),
      }),
    );

    render(<TelemetryPanel robotId="robot-1" />);

    // Live telemetry still rendered
    expect(screen.getByText('75.0%')).toBeInTheDocument();
    // Localized history error displayed
    expect(screen.getByText(/History unavailable: Unauthorized telemetry query/i)).toBeInTheDocument();
  });
});
