import React, { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, type = 'text', id, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold text-slate-700">
            {label}
            {props.required && <span className="text-rose-500 ml-0.5">*</span>}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            type={type}
            className={cn(
              'w-full bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder:text-slate-400',
              'py-2 px-3 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-600 transition-all duration-150',
              'disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed',
              icon && 'pl-9',
              error && 'border-rose-400 focus:ring-rose-500/20 focus:border-rose-600',
              className
            )}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-xs text-rose-600 font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-slate-500">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
