import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
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

    expect(screen.getByText('NAVIGEN')).toBeInTheDocument();
    expect(screen.getByText('GCS')).toBeInTheDocument();
    expect(screen.getByText('OPERATIONAL')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Robot/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Mission/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Sensors/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Camera/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Logs/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
  });

  it('highlights the active route correctly', () => {
    render(
      <MemoryRouter initialEntries={[ROUTES.MISSION]}>
        <Sidebar />
      </MemoryRouter>,
    );

    const missionLink = screen.getByRole('link', { name: /Mission/i });
    expect(missionLink.className).toContain('text-sky-400');
  });

  it('triggers onNavigate when a link or close button is clicked', () => {
    const handleNavigate = vi.fn();
    render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <Sidebar onNavigate={handleNavigate} />
      </MemoryRouter>,
    );

    const robotLink = screen.getByRole('link', { name: /Robot/i });
    act(() => {
      robotLink.click();
    });
    expect(handleNavigate).toHaveBeenCalled();

    const closeBtn = screen.getByRole('button', { name: /Close navigation/i });
    act(() => {
      closeBtn.click();
    });
    expect(handleNavigate).toHaveBeenCalledTimes(2);
  });
});
