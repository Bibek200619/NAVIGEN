import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bot, Target, Cpu, Video, ScrollText, Settings } from 'lucide-react';
import { ROUTES } from '../../constants/routes';

export const Sidebar: React.FC = () => {
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
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
      <div className="h-16 flex items-center px-6 border-b border-slate-800">
        <span className="font-bold text-lg text-white tracking-wider">NAVIGEN</span>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-sky-400'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`
            }
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
