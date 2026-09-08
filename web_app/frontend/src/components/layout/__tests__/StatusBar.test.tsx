import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../StatusBar';

describe('StatusBar', () => {
  it('renders the operator workspace identity', () => {
    render(<StatusBar />);
    expect(screen.getByText(/NAVIGEN/)).toBeInTheDocument();
    expect(screen.getByText('Read the field. Stay in control.')).toBeInTheDocument();
  });
});
