import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'brand' | 'sky' | 'amber' | 'rose' | 'slate' | 'violet';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-500/12 text-brand-300 ring-brand-500/25',
  sky: 'bg-accent-500/12 text-accent-400 ring-accent-500/25',
  amber: 'bg-warn-500/12 text-warn-400 ring-warn-500/25',
  rose: 'bg-err-500/12 text-err-400 ring-err-500/25',
  slate: 'bg-white/[0.06] text-ink-200 ring-white/10',
  violet: 'bg-violet-500/12 text-violet-300 ring-violet-500/25',
};

interface BadgeProps {
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'slate', dot, pulse, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          )}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {children}
    </span>
  );
}
