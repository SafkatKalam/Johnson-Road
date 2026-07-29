import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, FileText, PlayCircle, AlertTriangle, Bell } from 'lucide-react';
import { notifications, type AppNotification } from '@/lib/mockData';

const typeConfig: Record<AppNotification['type'], { icon: typeof CheckCircle2; tone: string; bg: string }> = {
  completed: { icon: CheckCircle2, tone: 'text-brand-300', bg: 'bg-brand-500/10' },
  failed: { icon: AlertCircle, tone: 'text-err-400', bg: 'bg-err-500/10' },
  report: { icon: FileText, tone: 'text-violet-300', bg: 'bg-violet-500/10' },
  started: { icon: PlayCircle, tone: 'text-accent-400', bg: 'bg-accent-500/10' },
  warning: { icon: AlertTriangle, tone: 'text-warn-400', bg: 'bg-warn-500/10' },
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const handleClick = (to: string) => {
    navigate(to);
    onClose();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={open ? onClose : () => {}}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-200 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <Bell size={17} />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-400 ring-2 ring-ink-950" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-white/[0.08] bg-ink-850 shadow-pop"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-sm font-semibold text-white">Notifications</span>
              <span className="text-xs text-brand-300">3 new</span>
            </div>
            <div className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
              {notifications.map((n) => {
                const cfg = typeConfig[n.type];
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n.to)}
                    className="flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                      <Icon size={15} className={cfg.tone} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-100">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{n.detail}</p>
                      <p className="mt-1 text-[10px] text-ink-500">{n.time}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { handleClick('/processing'); }}
              className="w-full border-t border-white/[0.06] py-2.5 text-xs font-medium text-ink-300 transition-colors hover:bg-white/[0.03] hover:text-white"
            >
              View all activity
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
