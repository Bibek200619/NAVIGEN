import React from 'react';

interface ErrorMessageProps {
  message: string;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({ message }) => {
  return (
    <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
      {message}
    </div>
  );
};
