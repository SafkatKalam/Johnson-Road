import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  LayoutGrid,
  Video,
  FileBarChart,
  Clock,
  Settings,
  MapPin,
  Film,
  Cpu,
  Download,
  Calendar,
  AlertCircle,
  Loader2,
  Trash2,
  Archive,
  ArchiveRestore,
  ListChecks,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import {
  VideoSetupService,
  describeSetupError,
  type ActivityItem,
  type AnalyticsSummary,
  type JobItem,
  type ProjectItem,
  type ReportItem,
  type VideoItem,
} from '@/services/videoSetup.service';
import { formatDate, formatRelative, formatBytes } from '@/lib/utils';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'jobs', label: 'Jobs', icon: ListChecks },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'activity', label: 'Activity', icon: Clock },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const ACTION_WORDS: Record<string, string> = {
  project_created: 'created the project', project_updated: 'edited the project', project_archived: 'archived the project',
  project_restored: 'restored the project', upload_created: 'uploaded a video', upload_failed: 'had a video refused',
  upload_metadata_updated: 'edited video details', upload_deleted: 'removed a video', upload_source_deleted: 'deleted a video file',
  analysis_configuration_saved: 'saved analysis settings', job_created: 'queued a job', job_completed: 'finished a job',
  job_failed: 'had a job fail', job_cancelled: 'cancelled a job', job_cancel_requested: 'asked to cancel a job', job_retried: 'retried a job',
  report_created: 'made a report',
};

const duration = (s: number) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}m` : `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`);

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role; // only hides the archive button; the server decides
  const [activeTab, setActiveTab] = useState('overview');
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [error, setError] = useState('');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [busy, setBusy] = useState(false);
  // settings form
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [saved, setSaved] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const p = await VideoSetupService.getProject(id);
      setProject(p);
      setName(p.name);
      setLocation(p.location);
      setDescription(p.description);
      setState('ready');
      const [v, j, r, s, a] = await Promise.all([
        VideoSetupService.listVideos(id, { limit: 100 }),
        VideoSetupService.listJobs({ projectId: id, limit: 100 }),
        VideoSetupService.listReports({ projectId: id, limit: 100 }),
        VideoSetupService.analyticsSummary({ projectId: id }),
        VideoSetupService.projectActivity(id),
      ]);
      setVideos(v.items);
      setJobs(j.items);
      setReports(r.items);
      setSummary(s);
      setActivity(a.items);
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404 || status === 422) setState('missing');
      else { setError(describeSetupError(e)); setState((s) => (s === 'loading' ? 'error' : s)); }
    }
  }, [id]);

  useEffect(() => { setState('loading'); loadAll(); }, [loadAll]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      await fn();
      await loadAll();
      return true;
    } catch (e) {
      setError(describeSetupError(e));
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (state === 'loading') {
    return <div className="flex items-center gap-2 py-20 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Loading project…</div>;
  }
  if (state !== 'ready' || !project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-ink-400">{state === 'missing' ? 'Project not found.' : error || 'The project could not be loaded.'}</p>
        <Link to="/projects" className="mt-4">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const canArchive = role === 'owner' || role === 'admin';
  const lineTotal = summary?.lineCrossing.total ?? 0;
  const zoneTotal = summary?.zonePresence.total ?? 0;
  const footage = videos.reduce((s, v) => s + v.durationSeconds, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/projects')} aria-label="Back to projects" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-white">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-white">{project.name}</h2>
            <Badge tone={project.archived ? 'slate' : 'brand'}>{project.archived ? 'Archived' : 'Active'}</Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
            <span className="flex items-center gap-1"><MapPin size={11} /> {project.location || 'No location'}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {duration(footage)} footage</span>
            <span className="flex items-center gap-1"><Calendar size={11} /> Created {formatDate(project.createdAt)}</span>
            <span className="flex items-center gap-1"><Calendar size={11} /> Updated {formatRelative(project.updatedAt)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!project.archived && (
            <Link to="/upload">
              <Button size="sm" leftIcon={<Video size={14} />}>Add Video</Button>
            </Link>
          )}
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
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <tab.icon size={15} /> {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <Tile label="Videos" value={String(videos.length)} icon={Film} />
                <Tile label="Jobs" value={String(jobs.length)} icon={Cpu} />
                <Tile label="Line-crossing count" value={String(lineTotal)} icon={ListChecks} hint="estimate" />
                <Tile label="Zone-presence count" value={String(zoneTotal)} icon={LayoutGrid} hint="estimate" />
              </div>
              <Card padding="lg">
                <CardHeader title="About" subtitle={summary?.videosAnalysed ? `Totals use the latest completed job of each of ${summary.videosAnalysed} analysed video(s).` : 'No video has been analysed yet.'} />
                <p className="mt-4 whitespace-pre-wrap text-sm text-ink-300">{project.description || 'No description.'}</p>
                {summary && (lineTotal > 0 || zoneTotal > 0) && (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {lineTotal > 0 && <Breakdown title="Line crossing by class" data={summary.lineCrossing.byClass} />}
                    {zoneTotal > 0 && <Breakdown title="Zone presence by class" data={summary.zonePresence.byClass} />}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'videos' && (
            <Card padding="none">
              {videos.length === 0 ? (
                <p className="p-6 text-sm text-ink-400">No videos yet. Use “Add Video” to upload one.</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {videos.map((v) => (
                    <div key={v.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-100">{v.name}</p>
                        <p className="text-xs text-ink-400">
                          {duration(v.durationSeconds)} · {v.widthPx}×{v.heightPx} · {v.frameRate} fps · {formatBytes(v.sizeBytes)}
                          {v.metadata.cameraId ? ` · ${v.metadata.cameraId}` : ''}{v.metadata.recordedDate ? ` · recorded ${v.metadata.recordedDate}` : ''}
                        </p>
                      </div>
                      <Badge tone={v.jobCount ? 'brand' : 'slate'}>{v.jobCount ? `${v.jobCount} job(s)` : 'not analysed'}</Badge>
                      {v.jobCount === 0 && !project.archived && (
                        <Button variant="ghost" size="sm" disabled={busy} leftIcon={<Trash2 size={13} />}
                          onClick={() => { if (window.confirm(`Remove ${v.name}? The file is deleted.`)) run(() => VideoSetupService.removeVideo(project.id, v.id)); }}>
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'jobs' && (
            <Card padding="none">
              {jobs.length === 0 ? (
                <p className="p-6 text-sm text-ink-400">No jobs yet.</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {jobs.map((j) => (
                    <div key={j.id} className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-100">{j.videoName}</p>
                        <p className="text-xs text-ink-400">Queued {formatRelative(j.queuedAt)}{j.attempt > 1 ? ` · attempt ${j.attempt}` : ''}</p>
                      </div>
                      <Badge tone={j.status === 'completed' ? 'brand' : j.status === 'failed' ? 'rose' : j.status === 'running' ? 'sky' : j.status === 'queued' ? 'amber' : 'slate'}>{j.status}</Badge>
                      {j.status === 'completed' && (
                        <Button variant="secondary" size="sm" disabled={busy} leftIcon={<FileBarChart size={13} />}
                          onClick={() => run(() => VideoSetupService.createReport(j.id, { type: 'summary' }))}>
                          Make report
                        </Button>
                      )}
                      <Link to={`/job-queue?job=${j.id}`}><Button variant="ghost" size="sm">Open</Button></Link>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'reports' && (
            <Card padding="none">
              {reports.length === 0 ? (
                <p className="p-6 text-sm text-ink-400">No reports yet. Make one from a completed job on the Jobs tab.</p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {reports.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink-100">{r.title}</p>
                        <p className="text-xs text-ink-400">Version {r.version} · {r.vehiclesCounted} vehicles (estimate) · {formatRelative(r.generatedAt)}</p>
                      </div>
                      <Button variant="secondary" size="sm" disabled={busy} leftIcon={<Download size={13} />}
                        onClick={() => run(() => VideoSetupService.downloadReportCsv(r.id, `report-${r.id.slice(0, 8)}-v${r.version}.csv`))}>
                        CSV
                      </Button>
                      <Button variant="ghost" size="sm" disabled={busy} leftIcon={<Download size={13} />}
                        onClick={() => run(() => VideoSetupService.downloadReportPdf(r.id, `report-${r.id.slice(0, 8)}-v${r.version}.pdf`))}>
                        PDF
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {activeTab === 'activity' && (
            <Card padding="none">
              {activity.length === 0 ? (
                <p className="p-6 text-sm text-ink-400">No activity yet.</p>
              ) : (
                <ol className="divide-y divide-white/[0.04]">
                  {activity.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span className="text-ink-100">{a.actor === 'system' ? 'The system' : a.actor}</span>
                      <span className="text-ink-400">{ACTION_WORDS[a.action] ?? a.action.replace(/_/g, ' ')}</span>
                      <span className="ml-auto shrink-0 text-xs text-ink-500">{formatRelative(a.at)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )}

          {activeTab === 'settings' && (
            <div className="mx-auto max-w-2xl space-y-4">
              <Card padding="lg">
                <CardHeader title="Project details" subtitle={project.archived ? 'Archived projects are read-only. Restore it to make changes.' : 'Name, location and description'} />
                <form
                  className="mt-5 space-y-4"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const changes: Record<string, string> = {};
                    if (name.trim() !== project.name) changes.name = name.trim();
                    if (location.trim() !== project.location) changes.location = location.trim();
                    if (description.trim() !== project.description) changes.description = description.trim();
                    if (Object.keys(changes).length === 0) return;
                    if (await run(() => VideoSetupService.updateProject(project.id, changes))) setSaved(true);
                  }}
                >
                  <Input label="Project name" maxLength={120} value={name} disabled={project.archived} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
                  <Input label="Location" maxLength={200} value={location} disabled={project.archived} onChange={(e) => { setLocation(e.target.value); setSaved(false); }} />
                  <div>
                    <label htmlFor="project-description" className="mb-1.5 block text-xs font-medium text-ink-200">Description</label>
                    <textarea id="project-description" rows={3} maxLength={2000} value={description} disabled={project.archived}
                      onChange={(e) => { setDescription(e.target.value); setSaved(false); }}
                      className="w-full resize-none rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 py-2 text-sm text-ink-50 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Button type="submit" disabled={busy || project.archived}>Save changes</Button>
                    {saved && <span className="text-xs text-brand-300">Saved</span>}
                  </div>
                </form>
              </Card>
              {canArchive && (
                <Card padding="lg">
                  <CardHeader title={project.archived ? 'Restore project' : 'Archive project'} subtitle={project.archived ? 'Make it active and editable again.' : 'Keeps everything, makes it read-only and hides it from the active list.'} />
                  <div className="mt-4">
                    {project.archived ? (
                      <Button variant="secondary" disabled={busy} leftIcon={<ArchiveRestore size={14} />} onClick={() => run(() => VideoSetupService.restoreProject(project.id))}>Restore</Button>
                    ) : (
                      <Button variant="secondary" disabled={busy} leftIcon={<Archive size={14} />} onClick={() => run(() => VideoSetupService.archiveProject(project.id))}>Archive</Button>
                    )}
                  </div>
                </Card>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Tile({ label, value, icon: Icon, hint }: { label: string; value: string; icon: typeof Film; hint?: string }) {
  return (
    <Card padding="sm">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-inset ring-white/[0.06]"><Icon size={16} /></div>
        <div>
          <div className="text-lg font-semibold text-white">{value}</div>
          <div className="text-xs text-ink-400">{label}{hint ? <span className="text-ink-500"> · {hint}</span> : null}</div>
        </div>
      </div>
    </Card>
  );
}

function Breakdown({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-3">
      <p className="mb-2 text-xs font-medium text-ink-200">{title}</p>
      {entries.map(([k, v]) => (
        <div key={k} className="mb-1.5 flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 capitalize text-ink-300">{k}</span>
          <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]"><div className="h-1.5 rounded-full bg-brand-500" style={{ width: `${(v / max) * 100}%` }} /></div>
          <span className="w-10 text-right font-mono text-ink-100">{v}</span>
        </div>
      ))}
    </div>
  );
}
