import { useTelemetry } from '../../hooks/useTelemetry';
export function TelemetryPanel() {
  const { telemetry, status, isConnected } = useTelemetry();
  const fresh = isConnected && telemetry && !telemetry.isStale;
  return (
    <section className="telemetry-summary">
      <header className="section-heading">
        <h2>Vehicle telemetry</h2>
        <span className="eyebrow">01</span>
      </header>
      <dl className="detail-list">
        <div>
          <dt>Gateway</dt>
          <dd>{status === 'connected' ? 'Connected' : 'Offline'}</dd>
        </div>
        <div>
          <dt>Data freshness</dt>
          <dd>{fresh ? 'Live' : telemetry ? 'Stale' : 'No data'}</dd>
        </div>
        <div>
          <dt>Last received</dt>
          <dd>
            {telemetry
              ? new Date(telemetry.timestamp).toLocaleTimeString()
              : '—'}
          </dd>
        </div>
      </dl>
      <p className="muted-note">
        {fresh
          ? 'Receiving vehicle measurements.'
          : 'Measurements will appear when the vehicle sends telemetry.'}
      </p>
    </section>
  );
}
