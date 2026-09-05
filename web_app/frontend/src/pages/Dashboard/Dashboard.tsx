import { Link } from 'react-router-dom';
import { ArrowUpRight, ArrowRight, Navigation } from 'lucide-react';
import { PageHeading } from '../../components/common/PageHeading';
import { CameraViewer } from '../../components/camera/CameraViewer';
import { TelemetryPanel } from '../../components/dashboard/TelemetryPanel';
import { useTelemetry } from '../../hooks/useTelemetry';
import { APP_CONFIG } from '../../constants/config';
export function DashboardPage() {
  const { telemetry, isConnected } = useTelemetry();
  const fresh = isConnected && telemetry && !telemetry.isStale;
  return (
    <>
      {APP_CONFIG.SIMULATION && (
        <p className="simulation-banner">
          Local UGV simulation · All camera and sensor data are simulated.{' '}
          <a
            href="http://127.0.0.1:8010"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open 3D simulator ↗
          </a>
        </p>
      )}
      <PageHeading
        eyebrow="FIELD OPERATIONS"
        title="A clear view ahead."
        description="Your vehicle, its surroundings, and the signals that matter."
        action={
          <Link className="button" to="/camera">
            Open live camera <ArrowUpRight size={16} />
          </Link>
        }
      />
      <dl className="metrics-strip">
        <div>
          <dt>Vehicle connection</dt>
          <dd className="metric-text">
            <i className={fresh ? 'status-dot live' : 'status-dot'} />
            {fresh
              ? telemetry.connectionStatus || 'Unknown'
              : 'Awaiting signal'}
          </dd>
        </div>
        <div>
          <dt>Battery level</dt>
          <dd>
            {fresh ? (telemetry.batteryLevel?.toFixed(0) ?? '—') : '—'}
            <small>%</small>
          </dd>
        </div>
        <div>
          <dt>Linear velocity</dt>
          <dd>
            {fresh ? (telemetry.linearVelocity?.toFixed(2) ?? '—') : '—'}
            <small>m/s</small>
          </dd>
        </div>
        <div>
          <dt>Angular velocity</dt>
          <dd>
            {fresh ? (telemetry.angularVelocity?.toFixed(2) ?? '—') : '—'}
            <small>rad/s</small>
          </dd>
        </div>
      </dl>
      <div className="overview-grid">
        <CameraViewer compact />
        <aside className="overview-details">
          <TelemetryPanel />
          <section className="mission-note">
            <Navigation size={20} strokeWidth={1.4} />
            <h3>Mission workspace</h3>
            <p>
              Review navigation goals and mission status before heading out.
            </p>
            <Link to="/mission" className="text-link">
              View missions <ArrowRight size={15} />
            </Link>
          </section>
        </aside>
      </div>
      <section className="overview-bottom">
        <p>
          <span className="eyebrow">AT A GLANCE</span>Video and vehicle
          telemetry connect independently.
        </p>
        <Link to="/sensors" className="text-link">
          Inspect sensors <ArrowUpRight size={15} />
        </Link>
      </section>
    </>
  );
}
