import React from 'react';

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  ...rest
}) => (
  <input
    className={
      'flex h-10 w-full border bg-white dark:bg-ink-900 border-neutral-300 dark:border-ink-500 ' +
      'px-4 py-2 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 ' +
      'focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 transition-colors ' +
      className
    }
    {...rest}
  />
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({
  className = '',
  ...rest
}) => (
  <textarea
    className={
      'flex min-h-[100px] w-full border bg-white dark:bg-ink-900 border-neutral-300 dark:border-ink-500 ' +
      'px-4 py-3 text-sm text-neutral-900 dark:text-white placeholder:text-neutral-400 ' +
      'focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/40 transition-colors resize-y ' +
      className
    }
    {...rest}
  />
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({
  className = '',
  ...rest
}) => (
  <select
    className={
      'flex h-10 w-full border bg-white dark:bg-ink-900 border-neutral-300 dark:border-ink-500 ' +
      'px-4 py-2 text-sm text-neutral-900 dark:text-white focus:outline-none focus:border-brand transition-colors ' +
      className
    }
    {...rest}
  />
);
