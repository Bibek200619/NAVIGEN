import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Header } from '../Header';
import type { UseWebSocketReturn } from '../../../hooks/useWebSocket';

/* ------------------------------------------------------------------ */
/* Mock useWebSocket                                                   */
/* ------------------------------------------------------------------ */

const mockUseWebSocket = vi.fn<() => UseWebSocketReturn>();

vi.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: () => mockUseWebSocket(),
}));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function defaultWsReturn(
  overrides: Partial<UseWebSocketReturn> = {},
): UseWebSocketReturn {
  return {
    isConnected: false,
    status: 'disconnected',
    latestMessage: null,
    sendMessage: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                               */
/* ------------------------------------------------------------------ */

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows System Online when connected', () => {
    mockUseWebSocket.mockReturnValue(
      defaultWsReturn({ isConnected: true, status: 'connected' }),
    );

    render(<Header />);

    expect(screen.getByText('System Online')).toBeInTheDocument();
  });

  it('shows Connecting... when connecting', () => {
    mockUseWebSocket.mockReturnValue(
      defaultWsReturn({ status: 'connecting' }),
    );

    render(<Header />);

    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('shows Reconnecting... when reconnecting', () => {
    mockUseWebSocket.mockReturnValue(
      defaultWsReturn({ status: 'reconnecting' }),
    );

    render(<Header />);

    expect(screen.getByText('Reconnecting...')).toBeInTheDocument();
  });

  it('shows System Offline when disconnected', () => {
    mockUseWebSocket.mockReturnValue(defaultWsReturn());

    render(<Header />);

    expect(screen.getByText('System Offline')).toBeInTheDocument();
  });
});
