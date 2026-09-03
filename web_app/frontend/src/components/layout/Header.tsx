import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="h-16 bg-slate-950 border-b border-slate-800 px-6 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-semibold text-slate-200">UGV Control Interface</h1>
      </div>
      <div className="flex items-center gap-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          System Online
        </span>
      </div>
    </header>
  );
};
