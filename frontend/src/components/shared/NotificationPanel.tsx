import { useRef, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, FileText, XCircle, Info, Film, Bell } from 'lucide-react';
import { api } from '@/services/api';

interface AppNotice {
  id: string;
  kind: 'upload_ready' | 'upload_failed' | 'job_completed' | 'job_failed' | 'job_cancelled' | 'report_ready' | 'invite' | 'info';
  title: string;
  detail: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const typeConfig: Record<AppNotice['kind'], { icon: typeof CheckCircle2; tone: string; bg: string }> = {
  job_completed: { icon: CheckCircle2, tone: 'text-brand-300', bg: 'bg-brand-500/10' },
  job_failed: { icon: AlertCircle, tone: 'text-err-400', bg: 'bg-err-500/10' },
  upload_failed: { icon: AlertCircle, tone: 'text-err-400', bg: 'bg-err-500/10' },
  job_cancelled: { icon: XCircle, tone: 'text-ink-300', bg: 'bg-white/[0.04]' },
  report_ready: { icon: FileText, tone: 'text-violet-300', bg: 'bg-violet-500/10' },
  upload_ready: { icon: Film, tone: 'text-accent-400', bg: 'bg-accent-500/10' },
  invite: { icon: Info, tone: 'text-accent-400', bg: 'bg-accent-500/10' },
  info: { icon: Info, tone: 'text-ink-300', bg: 'bg-white/[0.04]' },
};

const POLL_MS = 30000;

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onToggle?: () => void;
}

export function NotificationPanel({ open, onClose, onToggle }: NotificationPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [items, setItems] = useState<AppNotice[]>([]);
  const [unread, setUnread] = useState(0);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      setItems(data.items);
      setUnread(data.unreadCount);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (open) {
      document.addEventListener('mousedown', handler);
      document.addEventListener('keydown', esc);
    }
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', esc);
    };
  }, [open, onClose]);

  const handleClick = async (n: AppNotice) => {
    if (!n.read) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
      api.post(`/notifications/${n.id}/read`).catch(() => load());
    }
    // Links are app addresses only (the server refuses anything else).
    if (n.link && n.link.startsWith('/')) navigate(n.link);
    onClose();
  };

  const readAll = async () => {
    try {
      await api.post('/notifications/read-all');
      setItems((xs) => xs.map((x) => ({ ...x, read: true })));
      setUnread(0);
    } catch {
      load();
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle ?? (open ? onClose : undefined)}
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-ink-200 transition-colors hover:bg-white/[0.06] hover:text-white"
      >
        <Bell size={17} />
        {unread > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brand-400 ring-2 ring-ink-950" />}
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
              {unread > 0 ? (
                <button onClick={readAll} className="text-xs text-brand-300 hover:text-brand-200">{unread} new · mark all read</button>
              ) : (
                <span className="text-xs text-ink-500">All read</span>
              )}
            </div>
            <div className="max-h-96 divide-y divide-white/[0.04] overflow-y-auto">
              {failed && items.length === 0 && <p className="px-4 py-6 text-center text-xs text-ink-400">Notifications could not be loaded.</p>}
              {!failed && items.length === 0 && <p className="px-4 py-6 text-center text-xs text-ink-400">No notifications yet.</p>}
              {items.map((n) => {
                const cfg = typeConfig[n.kind] ?? typeConfig.info;
                const Icon = cfg.icon;
                return (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${n.read ? 'opacity-70' : ''}`}
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${cfg.bg}`}>
                      <Icon size={15} className={cfg.tone} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-100">{n.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{n.detail}</p>
                      <p className="mt-1 text-[10px] text-ink-500">{ago(n.createdAt)}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => { navigate('/job-queue'); onClose(); }}
              className="w-full border-t border-white/[0.06] py-2.5 text-xs font-medium text-ink-300 transition-colors hover:bg-white/[0.03] hover:text-white"
            >
              View all jobs
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
