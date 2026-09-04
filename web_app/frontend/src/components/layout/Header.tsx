import React from 'react';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { WebSocketStatus } from '../../services/websocket';
import { ShieldCheck, Menu, X } from 'lucide-react';

const getHeaderStatusConfig = (status: WebSocketStatus) => {
  switch (status) {
    case 'connected':
      return {
        label: 'System Online',
        containerClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        dotClass: 'bg-emerald-400 animate-pulse',
      };
    case 'connecting':
      return {
        label: 'Connecting...',
        containerClass: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
        dotClass: 'bg-sky-400 animate-pulse',
      };
    case 'reconnecting':
      return {
        label: 'Reconnecting...',
        containerClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        dotClass: 'bg-amber-400 animate-pulse',
      };
    case 'disconnected':
    default:
      return {
        label: 'System Offline',
        containerClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        dotClass: 'bg-rose-400',
      };
  }
};

export interface HeaderProps {
  onToggleMobileNav?: () => void;
  isMobileNavOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileNav,
  isMobileNavOpen = false,
}) => {
  const { status } = useWebSocket();
  const config = getHeaderStatusConfig(status);

  return (
    <header className="h-16 bg-slate-950 border-b border-slate-800 px-4 sm:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3 sm:gap-4">
        {onToggleMobileNav && (
          <button
            type="button"
            onClick={onToggleMobileNav}
            aria-label={isMobileNavOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={isMobileNavOpen}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800 md:hidden focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
          >
            {isMobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        )}
        <div>
          <h1 className="text-sm font-bold text-slate-100 tracking-tight flex items-center gap-2">
            <span>UGV Control Interface</span>
          </h1>
          <p className="text-[11px] text-slate-500 font-mono hidden sm:block">
            Autonomous Surface Ground Operations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Gateway link status badge */}
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium font-mono border ${config.containerClass}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
            {config.label}
          </span>
        </div>

        {/* Security indicator */}
        <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-slate-900/60 rounded border border-slate-800 text-[11px] text-slate-400 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
          <span>OPS PROTOCOL V2</span>
        </div>
      </div>
    </header>
  );
};
