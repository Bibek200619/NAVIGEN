import React from 'react';

interface PanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export const Panel: React.FC<PanelProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`p-4 rounded-lg bg-slate-900 border border-slate-800 text-slate-100 ${className}`}>
      {title && <h3 className="text-sm font-semibold mb-3 text-slate-300">{title}</h3>}
      {children}
    </div>
  );
};
