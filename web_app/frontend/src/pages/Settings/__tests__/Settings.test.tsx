import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SettingsPage } from '../Settings';

describe('SettingsPage', () => {
  it('renders the operator session form and service endpoints', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('heading', { name: 'Connection' })).toBeInTheDocument();
    expect(screen.getByLabelText('Access token')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect session/i })).toBeDisabled();
    expect(screen.getByText('http://localhost:3000')).toBeInTheDocument();
    expect(screen.getByText('ws://localhost:3000/ws/v1/telemetry')).toBeInTheDocument();
  });
});
