import type { ReactNode } from 'react';

interface KbdProps {
  children: ReactNode;
}

export function Kbd({ children }: KbdProps) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-xs bg-theme-card px-1 font-sans text-product-base text-theme-text-sec shadow-outline-theme">
      {children}
    </kbd>
  );
}
