import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MissionPage } from '../Mission';

describe('MissionPage', () => {
  it('renders the disconnected mission workspace', () => {
    render(<MemoryRouter><MissionPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Missions' })).toBeInTheDocument();
    expect(screen.getByText('Mission controls')).toBeInTheDocument();
    expect(screen.getByText('No past missions recorded for this robot.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'open the camera.' })).toHaveAttribute('href', '/camera');
  });
});
