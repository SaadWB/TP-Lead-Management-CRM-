import React from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | 'blue'
    | 'amber'
    | 'indigo'
    | 'emerald'
    | 'purple'
    | 'cyan'
    | 'teal'
    | 'rose'
    | 'slate'
    | 'gray';
  size?: 'sm' | 'md';
  dot?: boolean;
}

export function Badge({
  className,
  variant = 'slate',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const variants = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200/80',
    amber: 'bg-amber-50 text-amber-700 border-amber-200/80',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    purple: 'bg-purple-50 text-purple-700 border-purple-200/80',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200/80',
    teal: 'bg-teal-50 text-teal-700 border-teal-200/80',
    rose: 'bg-rose-50 text-rose-700 border-rose-200/80',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    gray: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  const dotColors = {
    blue: 'bg-blue-500',
    amber: 'bg-amber-500',
    indigo: 'bg-indigo-500',
    emerald: 'bg-emerald-500',
    purple: 'bg-purple-500',
    cyan: 'bg-cyan-500',
    teal: 'bg-teal-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-500',
    gray: 'bg-gray-500',
  };

  const sizes = {
    sm: 'text-[11px] font-medium px-2 py-0.5 rounded',
    md: 'text-xs font-semibold px-2.5 py-1 rounded-md',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center border font-medium transition-colors',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full mr-1.5', dotColors[variant])} />}
      {children}
    </span>
  );
}
