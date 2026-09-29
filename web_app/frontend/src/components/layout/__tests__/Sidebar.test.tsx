import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Sidebar } from '../Sidebar';
import { ROUTES } from '../../../constants/routes';

describe('Sidebar Component', () => {
  it('renders branding and all navigation links', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /NAVIGEN overview/i })).toBeInTheDocument();
    for (const label of ['Overview', 'Live camera', 'Robot', 'Sensors', 'Missions', 'Activity', 'Connection']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it('highlights the active route correctly', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.MISSION]}>
        <Sidebar />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Missions' })).toHaveClass('active');
  });
});
