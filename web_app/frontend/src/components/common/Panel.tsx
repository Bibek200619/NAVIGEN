import React from 'react';

export interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  headerAction?: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  children,
  className = '',
  headerAction,
}) => {
  return (
    <div
      className={`p-4 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-100 shadow-sm ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-slate-800/80">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 font-mono">
            {title}
          </h3>
          {headerAction && <div>{headerAction}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
