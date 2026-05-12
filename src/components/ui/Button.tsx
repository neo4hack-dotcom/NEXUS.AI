import React from 'react';

type Variant = 'primary' | 'ghost' | 'outline' | 'subtle' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const base =
  'inline-flex items-center justify-center font-bold uppercase tracking-[0.14em] transition-all duration-150 ' +
  'disabled:opacity-40 disabled:cursor-not-allowed select-none whitespace-nowrap';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand text-white hover:bg-brand-600 active:bg-brand-700 shadow-[0_0_0_1px_rgba(255,62,0,0.6)]',
  ghost:
    'bg-transparent text-neutral-900 dark:text-white hover:bg-neutral-200 dark:hover:bg-ink-700',
  outline:
    'border border-neutral-300 dark:border-ink-500 text-neutral-900 dark:text-white hover:border-brand hover:text-brand',
  subtle:
    'bg-neutral-200 dark:bg-ink-700 text-neutral-900 dark:text-white hover:bg-neutral-300 dark:hover:bg-ink-600',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-[10px]',
  md: 'h-10 px-5 text-xs',
  lg: 'h-12 px-6 text-sm',
};

export const Button: React.FC<Props> = ({ variant = 'primary', size = 'md', className = '', ...rest }) => (
  <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...rest} />
);
