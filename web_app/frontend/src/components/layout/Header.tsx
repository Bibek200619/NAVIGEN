import { useLocation, Link } from 'react-router-dom';
import { useWebSocket } from '../../hooks/useWebSocket';
import { APP_CONFIG } from '../../constants/config';
const names: Record<string, string> = {
  dashboard: 'Overview',
  camera: 'Live camera',
  robot: 'Robot',
  sensors: 'Sensors',
  mission: 'Missions',
  logs: 'Activity',
  settings: 'Connection',
};
export function Header() {
  const { pathname } = useLocation();
  const { status } = useWebSocket();
  return (
    <header className="topbar">
      <span>
        {APP_CONFIG.SIMULATION ? 'SIMULATION' : 'Workspace'}{' '}
        <span className="breadcrumb-slash">/</span>{' '}
        <strong>{names[pathname.split('/')[1]] || 'Overview'}</strong>
      </span>
      <Link to="/settings" className="connection-state">
        <i
          className={status === 'connected' ? 'status-dot live' : 'status-dot'}
        />
        {status === 'connected'
          ? 'Gateway connected'
          : status === 'connecting' || status === 'reconnecting'
            ? 'Connecting gateway'
            : 'Gateway offline'}
      </Link>
    </header>
  );
}
