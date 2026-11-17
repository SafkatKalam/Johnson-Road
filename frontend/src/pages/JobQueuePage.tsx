import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ListChecks,
  Cpu,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Repeat,
  BarChart3,
  Loader2,
} from 'lucide-react';
import { Card, Badge, Button, ProgressBar, EmptyState } from '@/components/ui';
import { VideoSetupService, describeSetupError, type JobItem, type JobResults, type JobStatusName } from '@/services/videoSetup.service';
import { formatCompact } from '@/lib/utils';

type QueueTab = JobStatusName | 'all';

const tabs: { key: QueueTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'running', label: 'Running' },
  { key: 'queued', label: 'Queued' },
  { key: 'completed', label: 'Completed' },
  { key: 'failed', label: 'Failed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const statusConfig: Record<JobStatusName, { icon: typeof Cpu; tone: 'sky' | 'amber' | 'brand' | 'rose' | 'slate'; dot: boolean; pulse: boolean }> = {
  running: { icon: Play, tone: 'sky', dot: true, pulse: true },
  queued: { icon: Clock, tone: 'amber', dot: false, pulse: false },
  completed: { icon: CheckCircle2, tone: 'brand', dot: false, pulse: false },
  failed: { icon: AlertCircle, tone: 'rose', dot: false, pulse: false },
  cancelled: { icon: XCircle, tone: 'slate', dot: false, pulse: false },
};

const POLL_MS = 3000;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : '—');

export function JobQueuePage() {
  const [params] = useSearchParams();
  const focusId = params.get('job');
  const [activeTab, setActiveTab] = useState<QueueTab>('all');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, JobResults | 'loading' | string>>({});
  const alive = useRef(true);

  const load = useCallback(async () => {
    try {
      const page = await VideoSetupService.listJobs({ limit: 100 });
      if (!alive.current) return;
      setJobs(page.items);
      setError('');
    } catch (e) {
      if (alive.current) setError(describeSetupError(e));
    } finally {
      if (alive.current) setLoaded(true);
    }
  }, []);

  // Refresh while something is still queued or running; stop when the page closes.
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  useEffect(() => {
    alive.current = true;
    load();
    return () => { alive.current = false; };
  }, [load]);
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [active, load]);

  const filtered = useMemo(() => (activeTab === 'all' ? jobs : jobs.filter((j) => j.status === activeTab)), [activeTab, jobs]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: jobs.length };
    jobs.forEach((j) => { c[j.status] = (c[j.status] ?? 0) + 1; });
    return c;
  }, [jobs]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    if (acting) return;
    setActing(id);
    setError('');
    try {
      await fn();
      await load();
    } catch (e) {
      setError(describeSetupError(e));
    } finally {
      setActing(null);
    }
  };

  const showResults = async (id: string) => {
    if (results[id] && results[id] !== 'loading' && typeof results[id] !== 'string') {
      setResults((r) => { const n = { ...r }; delete n[id]; return n; });
      return;
    }
    setResults((r) => ({ ...r, [id]: 'loading' }));
    try {
      const res = await VideoSetupService.jobResults(id);
      setResults((r) => ({ ...r, [id]: res }));
    } catch (e) {
      setResults((r) => ({ ...r, [id]: describeSetupError(e) }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Job Queue</h2>
          <p className="mt-1 text-sm text-ink-400">Monitor and manage all processing jobs.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="sky" dot pulse={(counts.running ?? 0) > 0}>{counts.running ?? 0} running</Badge>
          <Badge tone="amber">{counts.queued ?? 0} queued</Badge>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/40 p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
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
      {!loaded ? (
        <Card padding="lg"><p className="flex items-center gap-2 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Loading jobs…</p></Card>
      ) : filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={ListChecks}
            title={jobs.length === 0 ? 'No jobs yet' : 'No jobs in this category'}
            description={jobs.length === 0 ? 'Queue a video from the Upload Center to start an analysis.' : 'Jobs will appear here when they match the selected filter.'}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((job, i) => {
              const cfg = statusConfig[job.status];
              const StatusIcon = cfg.icon;
              const res = results[job.id];
              const busy = acting === job.id;
              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
                >
                  <Card padding="md" className={job.id === focusId ? 'ring-1 ring-brand-500/40' : ''}>
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
                          <p className="truncate text-sm font-semibold text-white">{job.projectName ?? 'Project'} · {job.videoName ?? 'video'}</p>
                          <Badge tone={cfg.tone} dot={cfg.dot} pulse={cfg.pulse}>{job.cancelRequested ? 'cancelling' : job.status}</Badge>
                          {job.attempt > 1 && <Badge tone="slate">attempt {job.attempt}</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-400">
                          {job.stage} · Queued {when(job.queuedAt)}{job.startedAt ? ` · Started ${when(job.startedAt)}` : ''}{job.finishedAt ? ` · Finished ${when(job.finishedAt)}` : ''}
                        </p>

                        {/* Progress: real frames only; no total means no percentage and no time estimate */}
                        {job.status === 'running' && (
                          <div className="mt-3 max-w-md">
                            {job.framesTotal ? <ProgressBar value={job.progressPercent} size="sm" tone="sky" /> : null}
                            <div className="mt-2 flex items-center gap-4 text-[11px] text-ink-400">
                              {job.framesTotal ? <span>{job.progressPercent}%</span> : null}
                              <span>{formatCompact(job.framesDone)}{job.framesTotal ? ` / ${formatCompact(job.framesTotal)}` : ''} frames</span>
                              {job.processingFps ? <span>{job.processingFps} FPS</span> : null}
                              {job.device ? <span>{job.device}</span> : null}
                            </div>
                          </div>
                        )}
                        {job.status === 'queued' && job.queuePosition && (
                          <div className="mt-2 text-[11px] text-ink-400">Queue position: {job.queuePosition}</div>
                        )}
                        {job.status === 'failed' && job.error && (
                          <p className="mt-2 text-xs text-err-400">{job.error.message} <span className="text-ink-500">Diagnostic id {job.error.diagnosticId}</span></p>
                        )}
                        {res && (
                          <div className="mt-3 rounded-lg border border-white/[0.06] bg-ink-900/40 p-3 text-xs text-ink-300">
                            {res === 'loading' ? 'Loading results…' : typeof res === 'string' ? res : (
                              <>
                                <p className="text-sm text-white">{res.vehiclesCounted} vehicles counted <span className="text-xs text-ink-400">(estimate, {res.method === 'line_crossing' ? 'line crossing' : 'zone presence'})</span></p>
                                <p className="mt-1">{Object.entries(res.totalsByClass).map(([k, v]) => `${k} ${v}`).join(' · ') || 'No vehicles counted'}</p>
                                <p className="mt-1 text-ink-500">Model {res.provenance.model} · {res.framesProcessed} frames · code {res.provenance.codeVersion}</p>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Actions the server allows for this state */}
                      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                        {(job.status === 'queued' || (job.status === 'running' && !job.cancelRequested)) && (
                          <Button variant="ghost" size="sm" disabled={busy} leftIcon={<XCircle size={13} />} onClick={() => act(job.id, () => VideoSetupService.cancelJob(job.id))}>Cancel</Button>
                        )}
                        {job.status === 'failed' && job.retryable && (
                          <Button variant="secondary" size="sm" disabled={busy} leftIcon={<RotateCcw size={13} />} onClick={() => act(job.id, () => VideoSetupService.retryJob(job.id))}>Retry</Button>
                        )}
                        {job.status === 'completed' && (
                          <Button variant="secondary" size="sm" leftIcon={<BarChart3 size={13} />} onClick={() => showResults(job.id)}>{res && res !== 'loading' && typeof res !== 'string' ? 'Hide results' : 'Results'}</Button>
                        )}
                        {(job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') && (
                          <Button variant="ghost" size="sm" disabled={busy} leftIcon={<Repeat size={13} />} onClick={() => act(job.id, () => VideoSetupService.rerunJob(job.id))}>Run again</Button>
                        )}
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
