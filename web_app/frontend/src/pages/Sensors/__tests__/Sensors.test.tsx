import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SensorsPage } from '../Sensors';

describe('SensorsPage', () => {
  it('renders the sensor interface table', () => {
    render(<SensorsPage />);
    expect(screen.getByRole('heading', { name: 'Sensors' })).toBeInTheDocument();
    expect(screen.getByText('Health and reporting frequency of the vehicle’s sensor interfaces.')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Sensor' })).toBeInTheDocument();
    expect(screen.getByText('/camera/image_raw')).toBeInTheDocument();
    expect(screen.getByText('No signal')).toBeInTheDocument();
  });
});
