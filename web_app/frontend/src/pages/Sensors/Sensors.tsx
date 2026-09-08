import { PageHeading } from '../../components/common/PageHeading';
import { ROS_TOPICS } from '../../constants/topics';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useState } from 'react';
import { useNow } from '../../hooks/useNow';
const sensors = [
  ['Camera', ROS_TOPICS.CAMERA_IMAGE_RAW],
  ['Inertial measurement', ROS_TOPICS.IMU_DATA],
  ['Wheel odometry', ROS_TOPICS.WHEEL_ODOM],
  ['Transforms', ROS_TOPICS.TF],
  ['Joint states', ROS_TOPICS.JOINT_STATES],
];
type Sensor = {
  topic?: string;
  name?: string;
  is_active?: boolean;
  frequency_hz?: number;
};
export function SensorsPage() {
  const now = useNow();
  const { latestMessage, isConnected } = useWebSocket<Sensor>();
  const [previous, setPrevious] = useState(latestMessage);
  const [readings, setReadings] = useState<
    Record<string, { value: Sensor; received: number }>
  >({});
  if (previous !== latestMessage) {
    setPrevious(latestMessage);
    if (
      latestMessage?.event_type === 'sensor.status' &&
      latestMessage.payload.topic
    )
      setReadings({
        ...readings,
        [latestMessage.payload.topic]: {
          value: latestMessage.payload,
          received: Date.parse(latestMessage.received_at),
        },
      });
  }
  return (
    <>
      <PageHeading
        eyebrow="VEHICLE SYSTEMS"
        title="Sensors"
        description="Health and reporting frequency of the vehicle’s sensor interfaces."
      />
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Sensor</th>
              <th>ROS topic</th>
              <th>Frequency</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sensors.map(([name, topic]) => {
              const reading = readings[topic];
              const current =
                isConnected && reading && now - reading.received < 5000;
              return (
                <tr key={topic}>
                  <td>{name}</td>
                  <td className="mono">{topic}</td>
                  <td>
                    {current && reading.value.frequency_hz != null
                      ? `${reading.value.frequency_hz} Hz`
                      : '—'}
                  </td>
                  <td>
                    <span className="row-status">
                      <i
                        className={
                          current && reading.value.is_active
                            ? 'status-dot live'
                            : 'status-dot'
                        }
                      />
                      {current
                        ? reading.value.is_active
                          ? 'Active'
                          : 'Inactive'
                        : 'No signal'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted-note">
        Sensor health comes from vehicle telemetry. A camera stream can be
        available independently.
      </p>
    </>
  );
}
