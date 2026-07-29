import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WizardStepperProps {
  steps: string[];
  current: number;
  onStepClick?: (step: number) => void;
}

export function WizardStepper({ steps, current, onStepClick }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const isComplete = i < current;
        const isActive = i === current;
        const isClickable = i <= current && onStepClick;
        return (
          <div key={i} className="flex items-center shrink-0">
            <button
              onClick={() => isClickable && onStepClick(i)}
              disabled={!isClickable}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors',
                isClickable && 'hover:bg-white/[0.04]',
                !isClickable && 'cursor-default',
              )}
            >
              <div
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                  isComplete && 'bg-brand-500 text-ink-950',
                  isActive && 'bg-accent-500 text-white ring-4 ring-accent-500/20',
                  !isComplete && !isActive && 'bg-white/[0.06] text-ink-400 ring-1 ring-white/[0.06]',
                )}
              >
                {isComplete ? <Check size={12} strokeWidth={3} /> : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs font-medium whitespace-nowrap',
                  isActive ? 'text-white' : isComplete ? 'text-ink-200' : 'text-ink-400',
                )}
              >
                {step}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div className={cn('mx-0.5 h-px w-4', isComplete ? 'bg-brand-500/40' : 'bg-white/[0.06]')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function WizardProgress({ steps, current }: { steps: string[]; current: number }) {
  const pct = (current / (steps.length - 1)) * 100;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <motion.div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}
