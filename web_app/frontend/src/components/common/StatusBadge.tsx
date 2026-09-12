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
    success: 'status-badge success',
    warning: 'status-badge warning',
    danger: 'status-badge danger',
    info: 'status-badge info',
    default: 'status-badge',
  };

  const dotClasses = {
    success: 'live',
    warning: 'warning',
    danger: 'danger',
    info: 'info',
    default: '',
  };

  return (
    <span className={`${variantClasses[variant]} ${className}`}>
      <span className={`status-dot ${dotClasses[variant]}`.trim()} />
      <span>{children || status || 'Unknown'}</span>
    </span>
  );
};
