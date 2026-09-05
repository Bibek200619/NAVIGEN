import type { ReactNode } from 'react';
export function Panel({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}
