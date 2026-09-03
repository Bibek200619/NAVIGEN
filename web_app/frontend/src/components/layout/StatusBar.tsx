import React from 'react';

export const StatusBar: React.FC = () => {
  return (
    <footer className="h-8 bg-slate-950 border-t border-slate-800 px-6 flex items-center justify-between text-xs text-slate-500">
      <span>NAVIGEN Frontend v0.1.0</span>
      <span>ROS Bridge: Disconnected</span>
    </footer>
  );
};
