import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  icon: LucideIcon;
  iconTone?: 'brand' | 'sky' | 'amber' | 'violet';
  sparkline?: number[];
  index?: number;
  tooltip?: string;
}

const iconTones: Record<string, string> = {
  brand: 'bg-brand-500/12 text-brand-300 ring-brand-500/20',
  sky: 'bg-accent-500/12 text-accent-400 ring-accent-500/20',
  amber: 'bg-warn-500/12 text-warn-400 ring-warn-500/20',
  violet: 'bg-violet-500/12 text-violet-300 ring-violet-500/20',
};

const sparkColors: Record<string, string> = {
  brand: '#10b981',
  sky: '#38bdf8',
  amber: '#fbbf24',
  violet: '#a78bfa',
};

export function KpiCard({ label, value, delta, icon: Icon, iconTone = 'brand', sparkline, index = 0, tooltip }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <motion.div
      className="surface surface-hover group relative overflow-hidden p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      {/* Tooltip on hover */}
      {tooltip && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 -translate-y-full opacity-0 transition-all duration-200 group-hover:-translate-y-[calc(100%-8px)] group-hover:opacity-100">
          <div className="mx-auto w-fit rounded-lg border border-white/10 bg-ink-850 px-3 py-1.5 text-xs text-ink-300 shadow-pop">
            {tooltip}
          </div>
        </div>
      )}
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset',
            iconTones[iconTone],
          )}
        >
          <Icon size={18} strokeWidth={2} />
        </div>
        {delta !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium',
              positive ? 'bg-brand-500/10 text-brand-300' : 'bg-err-500/10 text-err-400',
            )}
          >
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div className="mt-4">
        <div className="text-2xl font-semibold tracking-tight text-white">{value}</div>
        <div className="mt-1 text-sm text-ink-400">{label}</div>
      </div>
      {sparkline && sparkline.length > 0 && (
        <div className="mt-3 flex h-8 items-end gap-0.5">
          {sparkline.map((v, i) => {
            const max = Math.max(...sparkline);
            const h = (v / max) * 100;
            return (
              <motion.div
                key={i}
                className="flex-1 rounded-sm"
                style={{ backgroundColor: sparkColors[iconTone], opacity: 0.5 }}
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{ duration: 0.5, delay: index * 0.05 + i * 0.02 }}
              />
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
