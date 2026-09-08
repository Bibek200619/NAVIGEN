import { NavLink } from 'react-router-dom';
import {
  ArrowUpRight,
  LayoutDashboard,
  Bot,
  Target,
  Radio,
  Video,
  ScrollText,
  Settings,
} from 'lucide-react';
import { ROUTES } from '../../constants/routes';
const items = [
  [ROUTES.DASHBOARD, 'Overview', LayoutDashboard],
  [ROUTES.CAMERA, 'Live camera', Video],
  [ROUTES.ROBOT, 'Robot', Bot],
  [ROUTES.SENSORS, 'Sensors', Radio],
  [ROUTES.MISSION, 'Missions', Target],
  [ROUTES.LOGS, 'Activity', ScrollText],
  [ROUTES.SETTINGS, 'Connection', Settings],
] as const;
export function Sidebar() {
  return (
    <aside className="sidebar">
      <NavLink
        to={ROUTES.DASHBOARD}
        className="brand"
        aria-label="NAVIGEN overview"
      >
        <span className="brand-mark">N</span>NAVIGEN
        <span className="brand-period">®</span>
      </NavLink>
      <p className="nav-caption">WORKSPACE / 01</p>
      <nav aria-label="Main navigation">
        {items.map(([to, label, Icon]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={17} strokeWidth={1.6} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-foot">
        <span className="device-mark">
          <Bot size={20} strokeWidth={1.5} />
        </span>
        <p>
          Ground vehicle<small>NAVIGEN / UGV</small>
        </p>
        <ArrowUpRight size={15} />
      </div>
    </aside>
  );
}
