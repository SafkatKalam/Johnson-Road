import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number; // 0-100
  tone?: 'brand' | 'sky' | 'amber' | 'rose';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const toneColors: Record<string, string> = {
  brand: 'from-brand-500 to-brand-400',
  sky: 'from-accent-500 to-accent-400',
  amber: 'from-warn-500 to-warn-400',
  rose: 'from-err-500 to-err-400',
};

const heights = { sm: 'h-1.5', md: 'h-2', lg: 'h-2.5' };

export function ProgressBar({
  value,
  tone = 'brand',
  size = 'md',
  showLabel,
  animated = true,
  className,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-ink-300">{Math.round(clamped)}%</span>
        </div>
      )}
      <div className={cn('relative w-full overflow-hidden rounded-full bg-white/[0.06]', heights[size])}>
        {animated ? (
          <motion.div
            className={cn('h-full rounded-full bg-gradient-to-r', toneColors[tone])}
            initial={{ width: 0 }}
            animate={{ width: `${clamped}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ) : (
          <div
            className={cn('h-full rounded-full bg-gradient-to-r', toneColors[tone])}
            style={{ width: `${clamped}%` }}
          />
        )}
      </div>
    </div>
  );
}
