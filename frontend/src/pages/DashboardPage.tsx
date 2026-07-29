import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Car,
  Cpu,
  FileBarChart,
  Gauge,
  TrendingUp,
  Truck,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
  FolderKanban,
  FileText,
  Activity,
  Clock,
  Lightbulb,
  X,
  MapPin,
  Zap,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { KpiCard } from '@/components/shared/KpiCard';
import { ProjectCard } from '@/components/shared/ProjectCard';
import { Card, CardHeader, Button, ProgressBar, Timeline, Badge, Modal } from '@/components/ui';
import {
  dashboardKpis,
  trafficVolumeByHour,
  vehicleClassBreakdown,
  aiInsights,
  aiTimeline,
  recentActivity,
  quickActions,
  trafficByProject,
  segmentDetails,
  insightDetails,
} from '@/services/dashboard.service';
import { projects, type ProjectStatus } from '@/services/project.service';
import { processingJobs } from '@/services/processing.service';
import { statusTone, statusLabel } from '@/lib/helpers';
import { formatCompact, formatNumber } from '@/lib/utils';

const iconMap = { upload: UploadCloud, file: FileText, folder: FolderKanban, cpu: Cpu };
const insightIcon = { trending: TrendingUp, truck: Truck, check: CheckCircle2 };
const insightTone = { info: 'sky', warn: 'amber', success: 'brand' } as const;

type TrafficView = 'aggregate' | 'project' | 'live' | 'class';

export function DashboardPage() {
  const navigate = useNavigate();
  const recentProjects = projects.filter((p) => p.status !== 'failed').slice(0, 4);
  const activeJob = processingJobs.find((j) => j.status === 'processing');

  const [trafficView, setTrafficView] = useState<TrafficView>('aggregate');
  const [selectedProjectId, setSelectedProjectId] = useState('prj_1c9b');
  const [segmentModal, setSegmentModal] = useState<string | null>(null);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const trafficData =
    trafficView === 'project'
      ? trafficByProject[selectedProjectId] ?? trafficVolumeByHour
      : trafficVolumeByHour;

  const trafficProject = projects.find((p) => p.id === selectedProjectId);

  const viewTabs: { key: TrafficView; label: string }[] = [
    { key: 'aggregate', label: 'Aggregate' },
    { key: 'project', label: 'Project' },
    { key: 'live', label: 'Live' },
    { key: 'class', label: 'Vehicle Class' },
  ];

  const segmentDetail = segmentModal ? segmentDetails[segmentModal] : null;

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">Welcome back, Shadiatun</h2>
          <p className="mt-1 text-sm text-ink-400">
            {activeJob
              ? `${activeJob.projectName} is ${activeJob.progress}% through analysis.`
              : 'No active processing jobs right now.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Activity size={15} />}>
            System healthy
          </Button>
          <Link to="/upload">
            <Button size="sm" leftIcon={<UploadCloud size={15} />}>
              Upload footage
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total vehicles detected"
          value={formatCompact(dashboardKpis.totalVehicles)}
          delta={dashboardKpis.totalVehiclesDelta}
          icon={Car}
          iconTone="brand"
          index={0}
          sparkline={[3, 5, 4, 7, 6, 9, 8, 11, 10, 14]}
          tooltip="387,490 vehicles detected across 6 projects"
        />
        <KpiCard
          label="Active processing jobs"
          value={String(dashboardKpis.activeJobs)}
          icon={Cpu}
          iconTone="sky"
          index={1}
          sparkline={[0, 1, 2, 1, 3, 2, 1, 2, 1, 1]}
          tooltip="1 job running on NVIDIA A100 GPU"
        />
        <KpiCard
          label="Completed reports"
          value={String(dashboardKpis.completedReports)}
          delta={dashboardKpis.completedReportsDelta}
          icon={FileBarChart}
          iconTone="violet"
          index={2}
          sparkline={[2, 3, 4, 5, 6, 8, 9, 11, 12, 14]}
          tooltip="14 reports generated this month"
        />
        <KpiCard
          label="Hours of footage analyzed"
          value={`${dashboardKpis.hoursAnalyzed}h`}
          delta={dashboardKpis.hoursAnalyzedDelta}
          icon={Gauge}
          iconTone="amber"
          index={3}
          sparkline={[4, 6, 8, 10, 13, 16, 20, 24, 28, 32]}
          tooltip="158 hours of CCTV footage processed"
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Traffic volume chart with switcher */}
        <Card className="lg:col-span-2" padding="md">
          <CardHeader
            title="Traffic volume"
            subtitle={
              trafficView === 'project' && trafficProject
                ? trafficProject.name
                : trafficView === 'live'
                  ? 'Live data — updating every 5s'
                  : trafficView === 'class'
                    ? 'By vehicle class'
                    : 'Aggregate vehicle count across all active roads'
            }
            icon={<TrendingUp size={16} />}
            action={
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-ink-900/40 p-0.5">
                {viewTabs.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setTrafficView(tab.key)}
                    className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                      trafficView === tab.key ? 'bg-white/[0.08] text-white' : 'text-ink-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            }
          />
          {/* Project selector when in project view */}
          {trafficView === 'project' && (
            <div className="mt-3 flex items-center gap-2">
              <MapPin size={13} className="text-ink-400" />
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="h-8 rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 text-xs text-ink-50 focus:border-brand-500/50 focus:outline-none"
              >
                {projects.filter((p) => p.status === 'completed' || p.status === 'processing').map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              {trafficView === 'class' ? (
                <BarChart data={vehicleClassBreakdown} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]} maxBarSize={40}>
                    {vehicleClassBreakdown.map((e) => <Cell key={e.name} fill={e.color} />)}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={trafficData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trafficGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={trafficView === 'live' ? '#38bdf8' : '#10b981'} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={trafficView === 'live' ? '#38bdf8' : '#10b981'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hour" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
                  <YAxis tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                  <Tooltip content={<ChartTooltip valueFormatter={(v) => `${formatNumber(v)} vehicles`} />} />
                  <Area
                    type="monotone"
                    dataKey="vehicles"
                    stroke={trafficView === 'live' ? '#38bdf8' : '#10b981'}
                    strokeWidth={2}
                    fill="url(#trafficGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: trafficView === 'live' ? '#38bdf8' : '#10b981', stroke: '#0b0d13', strokeWidth: 2 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Vehicle class breakdown */}
        <Card padding="md">
          <CardHeader
            title="Vehicle classification"
            subtitle="Distribution by class"
            icon={<Car size={16} />}
          />
          <div className="mt-4 h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={vehicleClassBreakdown}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={48}
                  outerRadius={68}
                  paddingAngle={3}
                  stroke="none"
                >
                  {vehicleClassBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip valueFormatter={(v) => formatNumber(v)} />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {vehicleClassBreakdown.map((v) => (
              <div key={v.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-ink-300">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} />
                  {v.name}
                </span>
                <span className="font-medium text-ink-100">{formatCompact(v.value)}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Active jobs + AI timeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="md">
          <CardHeader
            title="Active processing jobs"
            subtitle="Live AI analysis pipeline"
            icon={<Cpu size={16} />}
            action={
              <Link to="/job-queue" className="text-xs font-medium text-brand-300 hover:text-brand-200">
                View all
              </Link>
            }
          />
          <div className="mt-4 space-y-3">
            {processingJobs.map((job) => (
              <div
                key={job.id}
                onClick={() => navigate('/processing')}
                className="cursor-pointer rounded-xl border border-white/[0.05] bg-ink-900/40 p-4 transition-colors hover:border-white/10 hover:bg-ink-900/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-100">{job.projectName}</p>
                    <p className="mt-0.5 text-xs text-ink-400">
                      {job.stage} · {job.status === 'processing' ? `${job.fps} FPS · ETA ${job.eta}` : job.eta}
                    </p>
                  </div>
                  <Badge tone={job.status === 'processing' ? 'sky' : job.status === 'completed' ? 'brand' : 'amber'} dot={job.status === 'processing'} pulse={job.status === 'processing'}>
                    {job.status === 'processing' ? `${job.progress}%` : job.status}
                  </Badge>
                </div>
                {job.status === 'processing' && (
                  <div className="mt-3">
                    <ProgressBar value={job.progress} size="sm" tone="sky" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* AI timeline - clickable segments */}
        <Card padding="md">
          <CardHeader
            title="AI processing timeline"
            subtitle="Click a segment for details"
            icon={<Activity size={16} />}
          />
          <div className="mt-5">
            <Timeline
              items={aiTimeline.map((t) => ({
                id: t.id,
                label: t.label,
                meta: t.time,
                status: t.status,
              }))}
            />
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-500">Video Segments</p>
            <div className="space-y-1.5">
              {[
                { id: '1', range: '00:00 — 06:00', status: 'completed' },
                { id: '2', range: '06:00 — 12:00', status: 'completed' },
                { id: '3', range: '12:00 — 18:00', status: 'active' },
                { id: '4', range: '18:00 — 24:00', status: 'pending' },
              ].map((seg) => (
                <button
                  key={seg.id}
                  onClick={() => setSegmentModal(seg.id)}
                  className="flex w-full items-center justify-between rounded-lg border border-white/[0.05] bg-ink-900/40 px-3 py-2 text-left transition-colors hover:border-white/10 hover:bg-ink-900/60"
                >
                  <span className="font-mono text-xs text-ink-200">{seg.range}</span>
                  <div className="flex items-center gap-2">
                    {seg.status === 'completed' ? (
                      <CheckCircle2 size={13} className="text-brand-400" />
                    ) : seg.status === 'active' ? (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-400" />
                    ) : (
                      <Clock size={12} className="text-ink-500" />
                    )}
                    <ArrowRight size={12} className="text-ink-500" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent projects + AI insights */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="md">
          <CardHeader
            title="Recent projects"
            subtitle="Click a project to view details"
            icon={<FolderKanban size={16} />}
            action={
              <Link to="/projects" className="text-xs font-medium text-brand-300 hover:text-brand-200">
                View all
              </Link>
            }
          />
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {recentProjects.map((p) => (
              <div key={p.id} onClick={() => navigate(`/projects/${p.id}`)}>
                <ProjectCard project={p} compact />
              </div>
            ))}
          </div>
        </Card>

        {/* AI insights - clickable with expanded panel */}
        <Card padding="md">
          <CardHeader
            title="AI insights"
            subtitle="Click to expand analysis"
            icon={<Lightbulb size={16} />}
            action={<Badge tone="brand">Auto</Badge>}
          />
          <div className="mt-4 space-y-3">
            {aiInsights.map((insight) => {
              const Icon = insightIcon[insight.icon as keyof typeof insightIcon];
              const tone = insightTone[insight.severity];
              const isExpanded = expandedInsight === insight.id;
              const detail = insightDetails[insight.id];
              return (
                <motion.div
                  key={insight.id}
                  className="cursor-pointer rounded-xl border border-white/[0.05] bg-ink-900/40 p-4"
                  whileHover={{ borderColor: 'rgba(255,255,255,0.1)' }}
                  onClick={() => setExpandedInsight(isExpanded ? null : insight.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset ${
                      tone === 'brand' ? 'bg-brand-500/12 text-brand-300 ring-brand-500/20' :
                      tone === 'sky' ? 'bg-accent-500/12 text-accent-400 ring-accent-500/20' :
                      'bg-warn-500/12 text-warn-400 ring-warn-500/20'
                    }`}>
                      <Icon size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink-100">{insight.title}</p>
                        {isExpanded ? <X size={13} className="shrink-0 text-ink-400" /> : <ArrowRight size={13} className="shrink-0 text-ink-400" />}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-ink-400">{insight.detail}</p>

                      <AnimatePresence>
                        {isExpanded && detail && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="mt-3 space-y-3 overflow-hidden border-t border-white/[0.06] pt-3"
                          >
                            <InsightSection icon={<TrendingUp size={12} />} label="Trend" text={detail.trend} tone="text-brand-300" />
                            <InsightSection icon={<Info size={12} />} label="Reason" text={detail.reason} tone="text-accent-400" />
                            <InsightSection icon={<Zap size={12} />} label="Recommendation" text={detail.recommendation} tone="text-warn-400" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Quick actions + recent activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card padding="md">
          <CardHeader title="Quick actions" icon={<ArrowRight size={16} />} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = iconMap[action.icon as keyof typeof iconMap];
              return (
                <Link key={action.id} to={action.to}>
                  <motion.div
                    className="surface surface-hover flex flex-col items-start gap-2 p-4"
                    whileHover={{ y: -2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-brand-300 ring-1 ring-white/[0.06]">
                      <Icon size={16} />
                    </div>
                    <span className="text-xs font-medium text-ink-100">{action.label}</span>
                  </motion.div>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card className="lg:col-span-2" padding="md">
          <CardHeader title="Recent activity" subtitle="Across all projects" icon={<Clock size={16} />} />
          <div className="mt-4 divide-y divide-white/[0.04]">
            {recentActivity.map((act) => {
              const tone = statusTone(act.status);
              return (
                <div
                  key={act.id}
                  onClick={() => act.projectId && navigate(`/projects/${act.projectId}`)}
                  className="flex cursor-pointer items-center gap-3 py-3 transition-colors hover:bg-white/[0.02]"
                >
                  <Badge tone={tone} dot={act.status === 'processing'}>
                    {statusLabel(act.status)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm text-ink-100">{act.projectName}</span>
                    <span className="text-sm text-ink-400"> — {act.action}</span>
                  </div>
                  <span className="shrink-0 text-xs text-ink-400">{act.time}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Segment detail modal */}
      <Modal
        open={!!segmentModal}
        onClose={() => setSegmentModal(null)}
        title={segmentDetail ? `Segment ${segmentDetail.id} — ${segmentDetail.range}` : ''}
        description="Detailed analysis for this time segment"
        size="md"
      >
        {segmentDetail && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <SegmentStat label="Vehicle Count" value={formatNumber(segmentDetail.vehicleCount)} />
              <SegmentStat label="Avg Speed" value={`${segmentDetail.avgSpeed} km/h`} />
              <SegmentStat label="Peak Density" value={`${segmentDetail.peakDensity} veh/min`} />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-400">Events</p>
              <div className="space-y-2">
                {segmentDetail.events.map((event, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg border border-white/[0.05] bg-ink-900/40 p-3 text-sm text-ink-300">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warn-400" />
                    {event}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function InsightSection({ icon, label, text, tone }: { icon: React.ReactNode; label: string; text: string; tone: string }) {
  return (
    <div>
      <div className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${tone}`}>
        {icon} {label}
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-300">{text}</p>
    </div>
  );
}

function SegmentStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.05] bg-ink-900/40 p-3 text-center">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload: Record<string, string | number> }>;
  valueFormatter?: (v: number) => string;
}

function ChartTooltip({ active, payload, valueFormatter }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-ink-850 px-3 py-2 shadow-pop">
      <p className="text-xs font-medium text-white">
        {payload[0].payload.hour ? `${payload[0].payload.hour}:00` : payload[0].name}
      </p>
      <p className="mt-0.5 text-xs text-ink-300">
        {valueFormatter ? valueFormatter(payload[0].value) : formatNumber(payload[0].value)}
      </p>
    </div>
  );
}
