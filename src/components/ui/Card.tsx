import React from 'react';

type Tone = 'default' | 'accent' | 'flat';

export const Card: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { tone?: Tone }
> = ({ className = '', tone = 'default', ...rest }) => {
  const base =
    tone === 'accent'
      ? 'bg-brand/5 border border-brand/30'
      : tone === 'flat'
      ? 'surface-flat'
      : 'surface';
  return <div className={`${base} border ${className}`} {...rest} />;
};

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...rest
}) => (
  <div
    className={`p-5 border-b border-neutral-200 dark:border-ink-600 ${className}`}
    {...rest}
  />
);

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className = '',
  ...rest
}) => (
  <h3
    className={`text-lg font-black tracking-tight uppercase ${className}`}
    {...rest}
  />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  ...rest
}) => <div className={`p-5 ${className}`} {...rest} />;
