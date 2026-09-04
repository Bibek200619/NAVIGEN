import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SensorsPage } from '../Sensors';
import { useRobotData } from '../../../hooks/useRobotData';
import { useSensorStatus } from '../../../hooks/useSensorStatus';
import type { Robot, SensorStatusResponse } from '../../../types/api';

vi.mock('../../../hooks/useRobotData', () => ({
  useRobotData: vi.fn(),
}));

vi.mock('../../../hooks/useSensorStatus', () => ({
  useSensorStatus: vi.fn(),
}));

describe('SensorsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders no robot state when there is no active robot selected', () => {
    vi.mocked(useRobotData).mockReturnValue({
      robots: [],
      selectedRobot: null,
      selectedRobotId: null,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      setSelectedRobot: vi.fn(),
    });

    vi.mocked(useSensorStatus).mockReturnValue({
      sensors: [],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SensorsPage />);

    expect(screen.getByText('No Active Robot')).toBeInTheDocument();
    expect(
      screen.getByText('Connect or select an active robot to view sensor interfaces.'),
    ).toBeInTheDocument();
  });

  it('renders sensor cards with real active sensor data', () => {
    const mockRobot: Robot = {
      id: 'robot-alpha',
      name: 'Alpha UGV',
      slug: 'alpha-ugv',
      status: 'idle',
      connection_status: 'connected',
      last_seen_at: '2026-09-04T12:00:00Z',
      description: null,
      metadata: {},
      created_at: '2026-09-04T12:00:00Z',
      updated_at: '2026-09-04T12:00:00Z',
    };

    const mockSensors: SensorStatusResponse[] = [
      {
        id: 'cam-1',
        robot_id: 'robot-alpha',
        sensor_key: 'camera',
        name: 'RGB Camera Sensor',
        topic: '/camera/image_raw',
        is_active: true,
        frequency_hz: 30,
        last_updated_at: '2026-09-04T12:00:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
      {
        id: 'imu-1',
        robot_id: 'robot-alpha',
        sensor_key: 'imu',
        name: 'IMU Sensor',
        topic: '/imu/data',
        is_active: false,
        frequency_hz: 100,
        last_updated_at: '2026-09-04T12:00:00Z',
        details: {},
        updated_at: '2026-09-04T12:00:00Z',
      },
    ];

    vi.mocked(useRobotData).mockReturnValue({
      robots: [mockRobot],
      selectedRobot: mockRobot,
      selectedRobotId: 'robot-alpha',
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      setSelectedRobot: vi.fn(),
    });

    vi.mocked(useSensorStatus).mockReturnValue({
      sensors: mockSensors,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SensorsPage />);

    expect(screen.getByText('Sensor Interfaces')).toBeInTheDocument();
    expect(screen.getByText('Alpha UGV')).toBeInTheDocument();
    expect(screen.getByText('RGB Camera Sensor')).toBeInTheDocument();
    expect(screen.getByText('30 Hz')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });
});
