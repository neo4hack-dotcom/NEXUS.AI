import React from 'react';

type Tone = 'default' | 'brand' | 'green' | 'amber' | 'red' | 'muted';

const tones: Record<Tone, string> = {
  default: 'border-neutral-300 dark:border-ink-500 text-neutral-700 dark:text-neutral-300',
  brand: 'border-brand text-brand',
  green: 'border-emerald-500 text-emerald-500',
  amber: 'border-amber-500 text-amber-500',
  red: 'border-red-500 text-red-500',
  muted: 'border-neutral-300 dark:border-ink-600 text-neutral-500',
};

export const Badge: React.FC<{ tone?: Tone; className?: string; children?: React.ReactNode }> = ({
  tone = 'default',
  className = '',
  children,
}) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] border ${tones[tone]} ${className}`}
  >
    {children}
  </span>
);
