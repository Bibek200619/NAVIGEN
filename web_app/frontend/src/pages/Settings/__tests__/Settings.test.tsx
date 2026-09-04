import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsPage } from '../Settings';

describe('SettingsPage', () => {
  it('renders application configuration and endpoint inputs', () => {
    render(<SettingsPage />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Application Configuration')).toBeInTheDocument();
    expect(screen.getByText('API Base URL')).toBeInTheDocument();
    expect(screen.getByText('WebSocket URL')).toBeInTheDocument();

    const apiInput = screen.getByLabelText('API Base URL');
    expect(apiInput).toHaveAttribute('readonly');

    const wsInput = screen.getByLabelText('WebSocket URL');
    expect(wsInput).toHaveAttribute('readonly');

    expect(screen.getByText('Runtime Environment')).toBeInTheDocument();
    expect(screen.getByText(/NAVIGEN Web GCS/)).toBeInTheDocument();
  });
});
