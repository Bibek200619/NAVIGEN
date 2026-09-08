import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LogsPage } from '../Logs';

describe('LogsPage', () => {
  it('prompts for an operator session when disconnected', () => {
    render(<MemoryRouter><LogsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByText('Connect an operator session to view activity.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open connection settings' })).toHaveAttribute('href', '/settings');
  });
});
