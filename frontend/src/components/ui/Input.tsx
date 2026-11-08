import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, leftIcon, rightSlot, className, id, ...props }, ref) => {
    // Always give the input an id, so its label is really linked to it (screen readers, click-on-label, tests).
    const autoId = useId();
    const inputId = id || props.name || autoId;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-ink-200">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 text-ink-300">{leftIcon}</span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'h-9 w-full rounded-lg border border-white/[0.08] bg-ink-900/60 text-sm text-ink-50 placeholder:text-ink-400 transition-colors',
              'focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
              leftIcon ? 'pl-9' : 'pl-3',
              rightSlot ? 'pr-9' : 'pr-3',
              className,
            )}
            {...props}
          />
          {rightSlot && <span className="absolute right-2.5">{rightSlot}</span>}
        </div>
        {hint && <p className="mt-1.5 text-xs text-ink-400">{hint}</p>}
      </div>
    );
  },
);
Input.displayName = 'Input';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, className, id, children, ...props }, ref) => {
    const selectId = id || props.name;
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 block text-xs font-medium text-ink-200">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-9 w-full rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 text-sm text-ink-50 transition-colors',
            'focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20',
            className,
          )}
          {...props}
        >
          {children}
        </select>
      </div>
    );
  },
);
Select.displayName = 'Select';
