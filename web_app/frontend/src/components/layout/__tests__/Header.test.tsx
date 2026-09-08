import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '../Header';

vi.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({ status: 'connected', isConnected: true, latestMessage: null }),
}));

describe('Header', () => {
  it('renders the current workspace and gateway state', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Header />
      </MemoryRouter>,
    );
    expect(screen.getByText('SIMULATION')).toBeInTheDocument();
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Gateway connected')).toBeInTheDocument();
  });
});
