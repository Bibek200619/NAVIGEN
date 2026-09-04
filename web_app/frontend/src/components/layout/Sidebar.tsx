import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Bot,
  Target,
  Cpu,
  Video,
  ScrollText,
  Settings,
  Radio,
  X,
} from 'lucide-react';
import { ROUTES } from '../../constants/routes';

export interface SidebarProps {
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const navItems = [
    { to: ROUTES.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard },
    { to: ROUTES.ROBOT, label: 'Robot', icon: Bot },
    { to: ROUTES.MISSION, label: 'Mission', icon: Target },
    { to: ROUTES.SENSORS, label: 'Sensors', icon: Cpu },
    { to: ROUTES.CAMERA, label: 'Camera', icon: Video },
    { to: ROUTES.LOGS, label: 'Logs', icon: ScrollText },
    { to: ROUTES.SETTINGS, label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 h-full bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-base text-slate-100 tracking-wider font-mono">
              NAVIGEN
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950/60 border border-sky-800/40 text-sky-400 font-semibold uppercase tracking-wider">
            GCS
          </span>
          {onNavigate && (
            <button
              type="button"
              onClick={onNavigate}
              className="p-1 text-slate-400 hover:text-slate-200 rounded md:hidden focus:outline-none focus:ring-1 focus:ring-sky-500"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-xs font-medium transition-all focus:outline-none focus:ring-1 focus:ring-sky-500 ${
                isActive
                  ? 'bg-slate-900 text-sky-400 font-semibold border border-sky-500/30 shadow-sm'
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200 border border-transparent'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="tracking-wide">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom Station Status Pill */}
      <div className="p-3 border-t border-slate-800/80">
        <div className="p-2.5 bg-slate-900/60 rounded border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="font-mono text-[10px] text-slate-500 uppercase tracking-wider">
            Station Mode
          </span>
          <span className="font-mono text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            OPERATIONAL
          </span>
        </div>
      </div>
    </aside>
  );
};
