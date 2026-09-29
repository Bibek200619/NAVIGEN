import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SensorStatus } from '../SensorStatus';
import type { SensorStatusResponse } from '../../../types/api';

// Mock the hook so tests can also test hook-connected mode if needed
vi.mock('../../../hooks/useSensorStatus', () => ({
  useSensorStatus: vi.fn(() => ({
    sensors: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
}));

describe('SensorStatus Component', () => {
  it('renders default unavailable state when no robot is connected', () => {
    render(<SensorStatus robotId={null} />);

    expect(screen.getByText('Sensor Health')).toBeInTheDocument();
    expect(screen.getByTestId('sensor-health-aggregate')).toHaveTextContent('-- / 5 reporting');

    const badges = screen.getAllByText('UNAVAILABLE');
    expect(badges.length).toBe(5);
  });

  it('renders truthful ACTIVE, INACTIVE, and UNAVAILABLE states with computed aggregate', () => {
    // 3 active, 1 inactive, 1 missing (TF missing)
    const mockSensors: SensorStatusResponse[] = [
      {
        id: '1',
        robot_id: 'robot-1',
        sensor_key: 'camera',
        name: 'Front Camera',
        topic: '/camera/image_raw',
        is_active: true,
        frequency_hz: 30,
        last_updated_at: '2026-09-04T12:00:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
      {
        id: '2',
        robot_id: 'robot-1',
        sensor_key: 'imu',
        name: 'IMU Sensor',
        topic: '/imu/data',
        is_active: true,
        frequency_hz: 100,
        last_updated_at: '2026-09-04T12:00:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
      {
        id: '3',
        robot_id: 'robot-1',
        sensor_key: 'wheel_odom',
        name: 'Wheel Odometry',
        topic: '/wheel/odom',
        is_active: false, // Inactive
        frequency_hz: 50,
        last_updated_at: '2026-09-04T12:00:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
      {
        id: '4',
        robot_id: 'robot-1',
        sensor_key: 'joint_states',
        name: 'Joint States',
        topic: '/joint_states',
        is_active: true,
        frequency_hz: 50,
        last_updated_at: '2026-09-04T12:00:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
      // Note: TF sensor is omitted
    ];

    render(<SensorStatus robotId="robot-1" sensors={mockSensors} />);

    // 3 active out of 5 core sensors
    expect(screen.getByTestId('sensor-health-aggregate')).toHaveTextContent('3 / 5 reporting');

    const activeBadges = screen.getAllByText('ACTIVE');
    expect(activeBadges.length).toBe(3);

    const inactiveBadges = screen.getAllByText('INACTIVE');
    expect(inactiveBadges.length).toBe(1);

    const unavailableBadges = screen.getAllByText('UNAVAILABLE');
    expect(unavailableBadges.length).toBe(1); // TF is unavailable
  });

  it('renders API error message when error occurs', () => {
    const error = new Error('Sensor telemetry network timeout');
    render(<SensorStatus robotId="robot-1" error={error} />);

    expect(screen.getByText(/Failed to load sensor status: Sensor telemetry network timeout/)).toBeInTheDocument();
    expect(screen.getByTestId('sensor-health-aggregate')).toHaveTextContent('Error');
  });

  it('renders loading state when isLoading is true', () => {
    render(<SensorStatus robotId="robot-1" isLoading={true} />);

    expect(screen.getByTestId('sensor-loading')).toHaveTextContent('Loading sensor health...');
    expect(screen.getByTestId('sensor-health-aggregate')).toHaveTextContent('Loading...');
  });
});
