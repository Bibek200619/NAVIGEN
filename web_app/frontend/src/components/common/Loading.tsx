import React from 'react';
import { RefreshCw } from 'lucide-react';

interface LoadingProps {
  message?: string;
  className?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Loading...', className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-slate-400 space-y-2.5 ${className}`}>
      <RefreshCw className="w-5 h-5 text-sky-400 animate-spin" />
      <span className="text-xs font-mono text-slate-300">{message}</span>
    </div>
  );
};
