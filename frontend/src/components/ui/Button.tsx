import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-ink-950 hover:bg-brand-400 active:bg-brand-600 shadow-[0_1px_0_0_rgba(255,255,255,0.2)_inset,0_4px_14px_-4px_rgba(16,185,129,0.6)]',
  secondary:
    'bg-white/[0.06] text-ink-50 hover:bg-white/[0.1] border border-white/[0.08]',
  ghost: 'text-ink-200 hover:text-white hover:bg-white/[0.06]',
  outline:
    'border border-white/[0.1] text-ink-100 hover:border-white/20 hover:bg-white/[0.04]',
  danger: 'bg-err-500 text-white hover:bg-err-400',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-sm gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', leftIcon, rightIcon, className, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 disabled:pointer-events-none disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  ),
);
Button.displayName = 'Button';

interface LinkButtonProps {
  to: string;
  variant?: Variant;
  size?: Size;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function LinkButton({ to, variant = 'primary', size = 'md', leftIcon, rightIcon, className, children }: LinkButtonProps) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  );
}
