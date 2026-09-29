import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveMap } from '../LiveMap';

describe('LiveMap Component', () => {
  it('renders tactical map header, viewport, and metadata', () => {
    render(<LiveMap />);

    expect(screen.getByText('Live Map')).toBeInTheDocument();
    expect(screen.getByText(/Ref: odom → base_link/)).toBeInTheDocument();
    expect(screen.getByText('MAP VIEW')).toBeInTheDocument();
    expect(screen.getByTestId('live-map-viewport')).toBeInTheDocument();
    expect(screen.getByText('Reference Frame')).toBeInTheDocument();
    expect(screen.getByText('Grid Division')).toBeInTheDocument();
    expect(screen.getByText('Projection')).toBeInTheDocument();
  });

  it('provides accessible map controls with interactive zoom and recenter', () => {
    render(<LiveMap />);

    const zoomInBtn = screen.getByRole('button', { name: 'Zoom In Map' });
    const zoomOutBtn = screen.getByRole('button', { name: 'Zoom Out Map' });
    const recenterBtn = screen.getByRole('button', { name: 'Recenter Map View' });
    const toggleGridBtn = screen.getByRole('button', { name: 'Toggle Coordinate Grid' });

    expect(zoomInBtn).toBeInTheDocument();
    expect(zoomOutBtn).toBeInTheDocument();
    expect(recenterBtn).toBeInTheDocument();
    expect(toggleGridBtn).toBeInTheDocument();

    fireEvent.click(zoomInBtn);
    expect(screen.getByText(/Scale: 0.80x/)).toBeInTheDocument();

    fireEvent.click(recenterBtn);
    expect(screen.getByText(/Scale: 1.00x/)).toBeInTheDocument();
  });
});
