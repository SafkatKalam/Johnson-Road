import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { FileBarChart, Download, FileText, Car, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardHeader, Button, Badge, Select, EmptyState } from '@/components/ui';
import { VideoSetupService, describeSetupError, type ProjectItem, type ReportDetail, type ReportItem } from '@/services/videoSetup.service';
import { formatNumber, formatRelative } from '@/lib/utils';

const clock = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${sec ? ':' + String(sec).padStart(2, '0') : ''}`;
};

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const selectedId = params.get('report');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    VideoSetupService.listProjects({ state: 'all', limit: 100 }).then((p) => setProjects(p.items)).catch(() => setProjects([]));
  }, []);

  const loadList = useCallback(async () => {
    try {
      const page = await VideoSetupService.listReports({ projectId: projectId || undefined, limit: 100 });
      setItems(page.items);
      setError('');
    } catch (e) {
      setError(describeSetupError(e));
    } finally {
      setLoaded(true);
    }
  }, [projectId]);
  useEffect(() => { loadList(); }, [loadList]);

  useEffect(() => {
    if (!selectedId) { setDetail(null); setDetailState('idle'); return; }
    let alive = true;
    setDetailState('loading');
    VideoSetupService.getReport(selectedId)
      .then((r) => { if (alive) { setDetail(r); setDetailState('idle'); } })
      .catch((e) => { if (alive) { setError(describeSetupError(e)); setDetailState('error'); } });
    return () => { alive = false; };
  }, [selectedId]);

  const open = (id: string) => setParams({ report: id });

  const download = async (format: 'csv' | 'pdf') => {
    if (!detail || downloading) return;
    setDownloading(true);
    setError('');
    try {
      await VideoSetupService.downloadReportFile(detail.id, format, `report-${detail.id.slice(0, 8)}-v${detail.version}.${format}`);
    } catch (e) {
      setError(describeSetupError(e));
    } finally {
      setDownloading(false);
    }
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? 'Project';

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Reports</h2>
          <p className="mt-1 text-sm text-ink-400">Counts from completed analyses. All counts are estimates.</p>
        </div>
        <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-auto" aria-label="Filter by project">
          <option value="">All projects</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* List */}
        <Card padding="none" className="lg:col-span-1">
          {!loaded ? (
            <p className="flex items-center gap-2 p-5 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Loading…</p>
          ) : items.length === 0 ? (
            <EmptyState icon={FileBarChart} title="No reports yet" description="Make a report from a completed job on a project's Jobs tab." />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {items.map((r) => (
                <button key={r.id} onClick={() => open(r.id)} aria-current={r.id === selectedId}
                  className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] ${r.id === selectedId ? 'bg-white/[0.05]' : ''}`}>
                  <span className="truncate text-sm font-medium text-ink-100">{r.title}</span>
                  <span className="text-xs text-ink-400">{projectName(r.projectId)} · v{r.version} · {formatNumber(r.vehiclesCounted)} vehicles · {formatRelative(r.generatedAt)}</span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Detail */}
        <div className="space-y-4 lg:col-span-2">
          {!selectedId ? (
            <Card padding="lg"><p className="text-sm text-ink-400">Choose a report to see its numbers.</p></Card>
          ) : detailState === 'loading' || !detail ? (
            <Card padding="lg"><p className="flex items-center gap-2 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Loading report…</p></Card>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <Card padding="lg">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">{detail.title}</h3>
                    <p className="mt-1 text-xs text-ink-400">{detail.analysisVersion}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone="slate">Version {detail.version}</Badge>
                      <Badge tone="sky">{detail.method === 'line_crossing' ? 'Line crossing' : 'Zone presence'}</Badge>
                      <Badge tone="amber">Estimate</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" disabled={downloading} leftIcon={downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} onClick={() => download('csv')}>CSV</Button>
                    <Button variant="secondary" size="sm" disabled={downloading} leftIcon={<FileText size={14} />} onClick={() => download('pdf')}>PDF</Button>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Stat icon={Car} label="Vehicles counted" value={formatNumber(detail.vehiclesCounted)} />
                  <Stat icon={Clock} label="Busiest period" value={detail.peak ? `${clock(detail.peak.startSeconds)} (+${Math.round(detail.bucketSeconds / 60)} min)` : '—'} />
                  <Stat icon={FileBarChart} label="Busiest period count" value={detail.peak ? formatNumber(detail.peak.count) : '—'} />
                </div>
                <p className="mt-3 text-[11px] text-ink-500">Times are from the start of the video.</p>
              </Card>

              <Card padding="lg">
                <CardHeader title="Vehicles per period" subtitle={`${Math.round(detail.bucketSeconds / 60)}-minute periods from the start of the video`} />
                <div className="mt-4 h-56">
                  {detail.series.length === 0 ? (
                    <p className="text-sm text-ink-400">No vehicles were counted with these options.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={detail.series.map((s) => ({ period: clock(s.startSeconds), count: s.count }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="period" tick={{ fill: '#8b93a7', fontSize: 11 }} />
                        <YAxis allowDecimals={false} tick={{ fill: '#8b93a7', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: '#11141c', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} />
                        <Bar dataKey="count" name="Vehicles" fill="#10b981" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Totals title="By vehicle class" data={detail.totalsByClass} />
                <Totals title="By direction" data={detail.totalsByDirection} />
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Car; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-3">
      <div className="flex items-center gap-2 text-xs text-ink-400"><Icon size={13} /> {label}</div>
      <div className="mt-1 text-lg font-semibold text-white">{value}</div>
    </div>
  );
}

function Totals({ title, data }: { title: string; data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  return (
    <Card padding="md">
      <p className="mb-3 text-sm font-medium text-white">{title}</p>
      {entries.length === 0 ? <p className="text-xs text-ink-400">None</p> : entries.map(([k, v]) => (
        <div key={k} className="flex items-center justify-between border-b border-white/[0.04] py-1.5 text-sm last:border-0">
          <span className="capitalize text-ink-300">{k.replace('_', ' ')}</span>
          <span className="font-mono text-ink-100">{formatNumber(v)}</span>
        </div>
      ))}
    </Card>
  );
}
