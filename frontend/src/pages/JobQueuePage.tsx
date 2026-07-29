import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListChecks,
  Cpu,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, Badge, Button, ProgressBar, EmptyState } from '@/components/ui';
import { jobQueue, type JobStatus, type JobPriority } from '@/services/processing.service';
import { formatCompact } from '@/lib/utils';

type QueueTab = JobStatus | 'all';

const tabs: { key: QueueTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'queued', label: 'Queued' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusConfig: Record<JobStatus, { icon: typeof Cpu; tone: 'sky' | 'amber' | 'brand' | 'rose' | 'slate'; dot: boolean; pulse: boolean }> = {
  running: { icon: Play, tone: 'sky', dot: true, pulse: true },
  processing: { icon: Play, tone: 'sky', dot: true, pulse: true },
  queued: { icon: Clock, tone: 'amber', dot: false, pulse: false },
  completed: { icon: CheckCircle2, tone: 'brand', dot: false, pulse: false },
  failed: { icon: AlertCircle, tone: 'rose', dot: false, pulse: false },
  cancelled: { icon: XCircle, tone: 'slate', dot: false, pulse: false },
};

const priorityTone: Record<JobPriority, 'rose' | 'sky' | 'slate'> = {
  high: 'rose',
  normal: 'sky',
  low: 'slate',
};

export function JobQueuePage() {
  const [activeTab, setActiveTab] = useState<JobStatus | 'all'>('all');
  const navigate = useNavigate();

  const filtered = useMemo(
    () => activeTab === 'all' ? jobQueue : jobQueue.filter((j) => j.status === activeTab),
    [activeTab],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobQueue.length };
    jobQueue.forEach((j) => { c[j.status] = (c[j.status] ?? 0) + 1; });
    return c;
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Job Queue</h2>
          <p className="mt-1 text-sm text-ink-400">Monitor and manage all processing jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="sky" dot pulse>{counts.running ?? 0} running</Badge>
          <Badge tone="amber">{counts.queued ?? 0} queued</Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {tab.label}
            <span className="text-xs text-ink-500">{counts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* Job list */}
      {filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={ListChecks}
            title="No jobs in this category"
            description="Jobs will appear here when they match the selected filter."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((job, i) => {
              const cfg = statusConfig[job.status];
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                >
                  <Card padding="md" hover onClick={() => navigate('/processing')}>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                      {/* Status icon */}
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${
                        cfg.tone === 'sky' ? 'bg-accent-500/12 text-accent-400 ring-accent-500/20' :
                        cfg.tone === 'amber' ? 'bg-warn-500/12 text-warn-400 ring-warn-500/20' :
                        cfg.tone === 'brand' ? 'bg-brand-500/12 text-brand-300 ring-brand-500/20' :
                        cfg.tone === 'rose' ? 'bg-err-500/12 text-err-400 ring-err-500/20' :
                        'bg-white/[0.04] text-ink-300 ring-white/[0.06]'
                      }`}>
                        <StatusIcon size={18} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{job.projectName}</p>
                          <Badge tone={cfg.tone} dot={cfg.dot} pulse={cfg.pulse}>{job.status}</Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-ink-400">{job.stage} · Started {job.startedAt}</p>

                        {/* Progress */}
                        {job.status === 'running' && (
                          <div className="mt-3 max-w-md">
                            <ProgressBar value={job.progress} size="sm" tone="sky" />
                            <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-400">
                              <span>{job.progress}%</span>
                              <span>ETA {job.eta}</span>
                              <span>{job.fps} FPS</span>
                              <span>GPU {job.gpu}%</span>
                            </div>
                          </div>
                        )}
                        {job.status === 'queued' && (
                          <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-400">
                            <span>Queue position: {job.queuePosition}</span>
                            <span>Est. wait: {job.eta}</span>
                          </div>
                        )}
                      </div>

                      {/* Priority + Action */}
                      <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                        <Badge tone={priorityTone[job.priority]}>{job.priority} priority</Badge>
                        <Button variant="ghost" size="sm" rightIcon={<ArrowRight size={13} />}>
                          Open Job
                        </Button>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
