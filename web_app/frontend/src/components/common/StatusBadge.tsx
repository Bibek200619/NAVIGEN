import React from 'react';

export interface StatusBadgeProps {
  status?: string;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default';
  children?: React.ReactNode;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'default',
  children,
  className = '',
}) => {
  const variantClasses = {
    success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    danger: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    info: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    default: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };

  const dotClasses = {
    success: 'bg-emerald-400',
    warning: 'bg-amber-400',
    danger: 'bg-rose-400',
    info: 'bg-sky-400',
    default: 'bg-slate-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono font-medium border whitespace-nowrap ${variantClasses[variant]} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClasses[variant]} shrink-0`} />
      <span>{children || status || 'Unknown'}</span>
    </span>
  );
};
