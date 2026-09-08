import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TelemetryPanel } from '../TelemetryPanel';
import { useTelemetry } from '../../../hooks/useTelemetry';

vi.mock('../../../hooks/useTelemetry', () => ({ useTelemetry: vi.fn() }));

const mockUseTelemetry = vi.mocked(useTelemetry);

describe('TelemetryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTelemetry.mockReturnValue({
      telemetry: null,
      status: 'disconnected',
      isConnected: false,
    });
  });

  it('renders the disconnected empty state', () => {
    render(<TelemetryPanel />);
    expect(screen.getByText('Vehicle telemetry')).toBeInTheDocument();
    expect(screen.getByText('Offline')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
    expect(screen.getByText('Measurements will appear when the vehicle sends telemetry.')).toBeInTheDocument();
  });

  it('renders connected live telemetry state', () => {
    mockUseTelemetry.mockReturnValue({
      telemetry: {
        timestamp: 1700000000000,
        batteryLevel: 92.4,
        isStale: false,
      },
      status: 'connected',
      isConnected: true,
    });
    render(<TelemetryPanel />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Receiving vehicle measurements.')).toBeInTheDocument();
    expect(screen.getByText(new Date(1700000000000).toLocaleTimeString())).toBeInTheDocument();
  });

  it('marks connected telemetry as stale', () => {
    mockUseTelemetry.mockReturnValue({
      telemetry: { timestamp: 1700000000000, isStale: true },
      status: 'connected',
      isConnected: true,
    });
    render(<TelemetryPanel />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });
});
