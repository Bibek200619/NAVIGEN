import { PageHeading } from '../../components/common/PageHeading';
import { useRobot } from '../../hooks/useRobot';
import { useTelemetry } from '../../hooks/useTelemetry';
export function RobotPage() {
  const { robotState, isConnected } = useRobot();
  const { telemetry } = useTelemetry();
  const fresh = isConnected && telemetry && !telemetry.isStale;
  const items = [
    [
      'Safety state',
      fresh ? telemetry.safetyState?.replaceAll('_', ' ') || 'Unknown' : '—',
    ],
    ['Robot ID', robotState?.id || '—'],
    [
      'Vehicle connection',
      fresh ? robotState?.connectionStatus || 'Unknown' : 'No signal',
    ],
    [
      'Linear velocity',
      fresh && telemetry.linearVelocity != null
        ? `${telemetry.linearVelocity.toFixed(2)} m/s`
        : '—',
    ],
    [
      'Angular velocity',
      fresh && telemetry.angularVelocity != null
        ? `${telemetry.angularVelocity.toFixed(2)} rad/s`
        : '—',
    ],
    [
      'Battery level',
      fresh && telemetry.batteryLevel != null
        ? `${telemetry.batteryLevel.toFixed(1)}%`
        : '—',
    ],
  ];
  return (
    <>
      <PageHeading
        eyebrow="VEHICLE / 01"
        title="Robot"
        description="The latest reported state of your ground vehicle."
      />
      <section className="settings-section">
        <div>
          <h2>Vehicle state</h2>
          <p>
            Readings reflect the latest telemetry received from the vehicle.
          </p>
        </div>
        <dl className="detail-list">
          {items.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="settings-section">
        <div>
          <h2>Position & orientation</h2>
          <p>Position and heading from the latest vehicle localization data.</p>
        </div>
        <dl className="detail-list">
          <div>
            <dt>Position X</dt>
            <dd>
              {fresh && telemetry.positionX != null
                ? `${telemetry.positionX.toFixed(2)} m`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Position Y</dt>
            <dd>
              {fresh && telemetry.positionY != null
                ? `${telemetry.positionY.toFixed(2)} m`
                : '—'}
            </dd>
          </div>
          <div>
            <dt>Heading</dt>
            <dd>
              {fresh && telemetry.yaw != null
                ? `${(((telemetry.yaw * 180) / Math.PI + 360) % 360).toFixed(1)}°`
                : '—'}
            </dd>
          </div>
        </dl>
      </section>
    </>
  );
}
