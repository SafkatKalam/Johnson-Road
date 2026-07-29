import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TimelineItem {
  id: string;
  label: ReactNode;
  meta?: ReactNode;
  status: 'completed' | 'active' | 'pending';
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

export function Timeline({ items, className }: TimelineProps) {
  return (
    <ol className={cn('relative space-y-1', className)}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        const dotColor =
          item.status === 'completed'
            ? 'bg-brand-500 text-ink-950'
            : item.status === 'active'
              ? 'bg-accent-500 text-white ring-4 ring-accent-500/20'
              : 'bg-ink-700 text-ink-400 ring-1 ring-white/[0.06]';
        return (
          <li key={item.id} className="relative flex gap-4 pb-5">
            {!isLast && (
              <span
                className={cn(
                  'absolute left-[13px] top-7 h-full w-px',
                  item.status === 'completed' ? 'bg-brand-500/30' : 'bg-white/[0.06]',
                )}
              />
            )}
            <div className={cn('relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full', dotColor)}>
              {item.status === 'completed' ? (
                <Check size={13} strokeWidth={3} />
              ) : item.status === 'active' ? (
                <motion.span
                  className="h-2 w-2 rounded-full bg-white"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 1.6, repeat: Infinity }}
                />
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </div>
            <div className="pt-1">
              <div
                className={cn(
                  'text-sm',
                  item.status === 'pending' ? 'text-ink-400' : 'text-ink-100',
                )}
              >
                {item.label}
              </div>
              {item.meta && <div className="mt-0.5 text-xs text-ink-400">{item.meta}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
