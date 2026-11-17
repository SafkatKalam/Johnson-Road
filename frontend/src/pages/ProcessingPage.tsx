import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Cpu, Activity, AlertCircle, Loader2, ListChecks, XCircle } from 'lucide-react';
import { Card, CardHeader, Badge, Button, ProgressBar, EmptyState } from '@/components/ui';
import { api } from '@/services/api';
import { VideoSetupService, describeSetupError, type JobItem } from '@/services/videoSetup.service';
import { formatCompact } from '@/lib/utils';

interface JobEvent { id: number; attempt: number; at: string; level: 'info' | 'success' | 'warn' | 'error'; code: string; message: string }

const POLL_MS = 2000;
const levelTone: Record<JobEvent['level'], string> = { info: 'text-ink-300', success: 'text-brand-300', warn: 'text-warn-400', error: 'text-err-400' };

/** Live view of jobs that are queued or running: real frames, speed and the job's own log lines. Nothing is estimated. */
export function ProcessingPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const selected = params.get('job') ?? jobs[0]?.id ?? null;

  const load = useCallback(async () => {
    try {
      const [running, queued] = await Promise.all([
        VideoSetupService.listJobs({ status: 'running', limit: 20 }),
        VideoSetupService.listJobs({ status: 'queued', limit: 20 }),
      ]);
      setJobs([...running.items, ...queued.items]);
      setError('');
    } catch (e) {
      setError(describeSetupError(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    if (!selected) { setEvents([]); return; }
    let alive = true;
    const pull = () => api.get(`/jobs/${selected}/events`, { params: { limit: 200 } })
      .then((r) => { if (alive) setEvents(r.data.items); })
      .catch(() => { if (alive) setEvents([]); });
    pull();
    const t = setInterval(pull, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, [selected]);

  const job = jobs.find((j) => j.id === selected) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Processing</h2>
        <p className="mt-1 text-sm text-ink-400">Jobs that are running or waiting. Finished jobs are on the Job Queue.</p>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {!loaded ? (
        <Card padding="lg"><p className="flex items-center gap-2 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Loading…</p></Card>
      ) : jobs.length === 0 ? (
        <Card padding="none">
          <EmptyState icon={Cpu} title="Nothing is processing" description="Queue a video from the Upload Center. Finished jobs are listed on the Job Queue."
            action={<Button variant="secondary" leftIcon={<ListChecks size={15} />} onClick={() => navigate('/job-queue')}>Open Job Queue</Button>} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card padding="none" className="lg:col-span-1">
            <div className="divide-y divide-white/[0.04]">
              {jobs.map((j) => (
                <button key={j.id} onClick={() => setParams({ job: j.id })} aria-current={j.id === selected}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-white/[0.03] ${j.id === selected ? 'bg-white/[0.05]' : ''}`}>
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm text-ink-100">{j.videoName}</span>
                    <Badge tone={j.status === 'running' ? 'sky' : 'amber'} dot={j.status === 'running'} pulse={j.status === 'running'}>{j.cancelRequested ? 'cancelling' : j.status}</Badge>
                  </span>
                  <span className="text-xs text-ink-400">{j.projectName}{j.status === 'queued' && j.queuePosition ? ` · position ${j.queuePosition}` : ''}</span>
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            {job && (
              <Card padding="lg">
                <CardHeader title={job.videoName ?? 'Job'} subtitle={`${job.projectName ?? ''} · stage: ${job.stage}`} icon={<Activity size={16} />} />
                <div className="mt-5 space-y-3">
                  {job.status === 'running' ? (
                    <>
                      {job.framesTotal ? <ProgressBar value={job.progressPercent} tone="sky" /> : <p className="text-xs text-ink-400">Total frame count unknown, so no percentage is shown.</p>}
                      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                        <Fact label="Progress" value={job.framesTotal ? `${job.progressPercent}%` : '—'} />
                        <Fact label="Frames" value={`${formatCompact(job.framesDone)}${job.framesTotal ? ' / ' + formatCompact(job.framesTotal) : ''}`} />
                        <Fact label="Speed" value={job.processingFps ? `${job.processingFps} fps` : '—'} />
                        <Fact label="Device" value={job.device ?? '—'} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-ink-300">Waiting for a worker{job.queuePosition ? ` (position ${job.queuePosition} in the queue)` : ''}.</p>
                  )}
                  {!job.cancelRequested && (
                    <Button variant="ghost" size="sm" leftIcon={<XCircle size={13} />}
                      onClick={() => VideoSetupService.cancelJob(job.id).then(load).catch((e) => setError(describeSetupError(e)))}>
                      Cancel job
                    </Button>
                  )}
                </div>
              </Card>
            )}
            <Card padding="lg">
              <CardHeader title="Log" subtitle="Messages from the worker for this job" />
              <div className="mt-4 max-h-80 space-y-1.5 overflow-y-auto font-mono text-xs" aria-live="polite">
                {events.length === 0 ? <p className="text-ink-400">No messages yet.</p> : events.map((e) => (
                  <p key={e.id} className={levelTone[e.level]}>
                    <span className="text-ink-500">{new Date(e.at).toLocaleTimeString()} </span>
                    {e.attempt > 1 ? <span className="text-ink-500">[attempt {e.attempt}] </span> : null}
                    {e.message}
                  </p>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-2.5">
      <div className="text-[11px] text-ink-400">{label}</div>
      <div className="mt-0.5 font-medium text-white">{value}</div>
    </div>
  );
}
