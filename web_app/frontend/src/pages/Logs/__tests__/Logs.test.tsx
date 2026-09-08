import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogsPage } from '../Logs';

describe('LogsPage', () => {
  it('renders system logs header and default logs', () => {
    render(<LogsPage />);

    expect(screen.getByText('System Logs')).toBeInTheDocument();
    expect(screen.getByText('Recent Logs')).toBeInTheDocument();
    expect(screen.getByText(/System initialized successfully/)).toBeInTheDocument();
    expect(screen.getByText(/Webapp foundation ready/)).toBeInTheDocument();
  });

  it('filters log items by level', () => {
    render(<LogsPage />);

    const errorFilterBtn = screen.getByRole('button', { name: 'ERROR' });
    fireEvent.click(errorFilterBtn);

    expect(screen.getByText('No log entries match the current filter.')).toBeInTheDocument();

    const infoFilterBtn = screen.getByRole('button', { name: 'INFO' });
    fireEvent.click(infoFilterBtn);

    expect(screen.getByText(/System initialized successfully/)).toBeInTheDocument();
  });

  it('filters log items by search query', () => {
    render(<LogsPage />);

    const searchInput = screen.getByLabelText('Search logs');
    fireEvent.change(searchInput, { target: { value: 'foundation' } });

    expect(screen.getByText(/Webapp foundation ready/)).toBeInTheDocument();
    expect(screen.queryByText(/System initialized successfully/)).not.toBeInTheDocument();
  });
});
