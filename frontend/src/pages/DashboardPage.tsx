import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Car, Cpu, FileBarChart, Film, UploadCloud, FolderKanban, AlertCircle, Loader2, ArrowRight, LayoutGrid } from 'lucide-react';
import { Card, CardHeader, Button, Badge, Select } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  VideoSetupService,
  describeSetupError,
  type AnalyticsSummary,
  type JobItem,
  type ProjectItem,
  type ReportItem,
} from '@/services/videoSetup.service';
import { formatNumber, formatRelative } from '@/lib/utils';

const POLL_MS = 15000;
const jobTone = (s: string) => (s === 'completed' ? 'brand' : s === 'failed' ? 'rose' : s === 'running' ? 'sky' : s === 'queued' ? 'amber' : 'slate') as 'brand' | 'rose' | 'sky' | 'amber' | 'slate';

export function DashboardPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const pid = projectId || undefined;
      const [p, s, j, r] = await Promise.all([
        VideoSetupService.listProjects({ limit: 100 }),
        VideoSetupService.analyticsSummary({ projectId: pid }),
        VideoSetupService.listJobs({ projectId: pid, limit: 6 }),
        VideoSetupService.listReports({ projectId: pid, limit: 5 }),
      ]);
      setProjects(p.items);
      setSummary(s);
      setJobs(j.items);
      setReports(r.items);
      setError('');
    } catch (e) {
      setError(describeSetupError(e));
    } finally {
      setLoaded(true);
    }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'running');
  useEffect(() => {
    if (!active) return;
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [active, load]);

  const running = summary?.jobsByStatus.running ?? 0;
  const queued = summary?.jobsByStatus.queued ?? 0;
  const lineTotal = summary?.lineCrossing.total ?? 0;
  const zoneTotal = summary?.zonePresence.total ?? 0;
  const classData = Object.entries(summary?.lineCrossing.byClass ?? {}).map(([k, v]) => ({ name: k, count: v })).sort((a, b) => b.count - a.count);
  const firstName = profile?.full_name?.split(' ')[0];

  if (!loaded) {
    return <div className="flex items-center gap-2 py-20 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Loading dashboard…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h2>
          <p className="mt-1 text-sm text-ink-400">
            {summary?.lastCompletedAt ? `Last analysis finished ${formatRelative(summary.lastCompletedAt)}.` : 'No analysis has finished yet.'} Counts are estimates.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-auto" aria-label="Filter by project">
            <option value="">All projects</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <Button leftIcon={<UploadCloud size={15} />} onClick={() => navigate('/upload')}>Upload video</Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi icon={Car} label="Line-crossing count" value={formatNumber(lineTotal)} hint="estimate" />
        <Kpi icon={LayoutGrid} label="Zone-presence count" value={formatNumber(zoneTotal)} hint="estimate" />
        <Kpi icon={Film} label="Videos analysed" value={String(summary?.videosAnalysed ?? 0)} />
        <Kpi icon={Cpu} label="Jobs running / queued" value={`${running} / ${queued}`} />
      </div>

      {projects.length === 0 && !projectId ? (
        <Card padding="lg">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-white">Start your first analysis</p>
              <p className="mt-1 text-xs text-ink-400">Create a project, upload one CCTV video, draw a counting line, and queue it.</p>
            </div>
            <Button leftIcon={<FolderKanban size={15} />} onClick={() => navigate('/upload')}>Get started</Button>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-2">
          <CardHeader title="Vehicles by class" subtitle={summary?.videosAnalysed ? `Line crossings, latest completed job of each video` : 'Appears after the first completed analysis'} />
          <div className="mt-4 h-60">
            {classData.length === 0 ? (
              <p className="text-sm text-ink-400">Nothing counted yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classData}>
                  <XAxis dataKey="name" tick={{ fill: '#8b93a7', fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: '#8b93a7', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#11141c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                  <Bar dataKey="count" name="Vehicles" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card padding="none">
          <div className="flex items-center justify-between px-5 pt-5">
            <p className="text-sm font-semibold text-white">Recent jobs</p>
            <Link to="/job-queue" className="flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200">All <ArrowRight size={12} /></Link>
          </div>
          <div className="mt-3 divide-y divide-white/[0.04]">
            {jobs.length === 0 ? <p className="px-5 pb-5 text-xs text-ink-400">No jobs yet.</p> : jobs.map((j, i) => (
              <motion.button key={j.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                onClick={() => navigate(`/job-queue?job=${j.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.03]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink-100">{j.videoName}</p>
                  <p className="truncate text-xs text-ink-400">{j.projectName} · {formatRelative(j.queuedAt)}</p>
                </div>
                <Badge tone={jobTone(j.status)} dot={j.status === 'running'} pulse={j.status === 'running'}>{j.status === 'running' && j.framesTotal ? `${j.progressPercent}%` : j.status}</Badge>
              </motion.button>
            ))}
          </div>
        </Card>
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between px-5 pt-5">
          <p className="text-sm font-semibold text-white">Recent reports</p>
          <Link to="/reports" className="flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200">All <ArrowRight size={12} /></Link>
        </div>
        <div className="mt-3 divide-y divide-white/[0.04]">
          {reports.length === 0 ? <p className="px-5 pb-5 text-xs text-ink-400">No reports yet.</p> : reports.map((r) => (
            <button key={r.id} onClick={() => navigate(`/reports?report=${r.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-white/[0.03]">
              <FileBarChart size={15} className="shrink-0 text-violet-300" />
              <span className="min-w-0 flex-1 truncate text-sm text-ink-100">{r.title}</span>
              <span className="shrink-0 text-xs text-ink-400">{formatNumber(r.vehiclesCounted)} vehicles · {formatRelative(r.generatedAt)}</span>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: typeof Car; label: string; value: string; hint?: string }) {
  return (
    <Card padding="md">
      <div className="flex items-center gap-2 text-xs text-ink-400"><Icon size={14} /> {label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-500">{hint}</div>}
    </Card>
  );
}
