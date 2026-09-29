import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CameraPreview } from '../CameraPreview';

vi.mock('../../../hooks/useCamera', () => ({
  useCamera: () => ({
    canvasRef: { current: null },
    state: 'authentication',
    message: 'Connect an operator session to view the camera.',
    dimensions: '—',
    fps: 0,
  }),
}));

describe('CameraPreview', () => {
  it('renders the front camera viewer and connection prompt', () => {
    render(<MemoryRouter><CameraPreview /></MemoryRouter>);
    expect(screen.getByRole('region', { name: 'Front camera viewer' })).toBeInTheDocument();
    expect(screen.getByText('Front camera')).toBeInTheDocument();
    expect(screen.getByText('Not connected')).toBeInTheDocument();
    expect(screen.getByText('Connect session')).toBeInTheDocument();
  });

  it('supports compact mode link to the full camera view', () => {
    render(<MemoryRouter><CameraPreview compact /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'Open full camera view' })).toHaveAttribute('href', '/camera');
  });
});
