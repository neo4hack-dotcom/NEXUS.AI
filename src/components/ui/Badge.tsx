import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
  className?: string;
  children?: React.ReactNode;
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div className={cn(
      "inline-flex items-center border px-2.5 py-1 text-[9px] font-mono uppercase tracking-widest transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
      {
        'border-transparent bg-primary text-primary-foreground hover:bg-primary/80': variant === 'default',
        'border-transparent bg-white text-black hover:bg-white/80': variant === 'secondary',
        'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80': variant === 'destructive',
        'text-foreground border-white/20': variant === 'outline',
        'border-emerald-500/50 bg-emerald-500/10 text-emerald-500': variant === 'success',
        'border-amber-500/50 bg-amber-500/10 text-amber-500': variant === 'warning',
      },
      className
    )} {...props} />
  )
}

export { Badge }
