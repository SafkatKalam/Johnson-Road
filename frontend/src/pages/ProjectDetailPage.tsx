import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
} from 'recharts';
import {
  ArrowLeft,
  LayoutGrid,
  Video,
  FileBarChart,
  BarChart3,
  Clock,
  Camera,
  Settings,
  MapPin,
  Film,
  Car,
  Cpu,
  HardDrive,
  Play,
  Download,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, ProgressBar } from '@/components/ui';
import { projects, projectVideos } from '@/services/project.service';
import { projectReportsList } from '@/services/report.service';
import { trafficByProject, vehicleClassBreakdown } from '@/services/dashboard.service';
import { timelineStages, processingJobs } from '@/services/processing.service';
import { statusTone, statusLabel, thumbnailGradient } from '@/lib/helpers';
import { formatCompact, formatNumber, formatDate, formatRelative, formatBytes } from '@/lib/utils';

const tabs = [
  { id: 'overview', label: 'Overview', icon: LayoutGrid },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function ProjectDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-ink-400">Project not found.</p>
        <Link to="/projects" className="mt-4">
          <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>Back to Projects</Button>
        </Link>
      </div>
    );
  }

  const videos = projectVideos[project.id] ?? [];
  const reports = projectReportsList[project.id] ?? [];
  const trafficData = trafficByProject[project.id] ?? trafficByProject.prj_8f2a;
  const tone = statusTone(project.status);
  const job = processingJobs.find((j) => j.projectName === project.name);

  return (
    <div className="space-y-6">
      {/* Breadcrumb + header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/projects')} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-white">
          <ArrowLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-white">{project.name}</h2>
            <Badge tone={tone} dot={project.status === 'processing'} pulse={project.status === 'processing'}>
              {statusLabel(project.status)}
            </Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
            <span className="flex items-center gap-1"><MapPin size={11} /> {project.location}</span>
            <span className="flex items-center gap-1"><Clock size={11} /> {project.duration}h footage</span>
            <span className="flex items-center gap-1"><Calendar size={11} /> Created {formatDate(project.createdAt)}</span>
            {project.updatedAt && <span className="flex items-center gap-1"><Calendar size={11} /> Updated {formatRelative(project.updatedAt)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {project.status === 'completed' && (
            <Link to="/reports">
              <Button variant="secondary" size="sm" leftIcon={<FileBarChart size={14} />}>View Reports</Button>
            </Link>
          )}
          <Link to="/upload">
            <Button size="sm" leftIcon={<Video size={14} />}>Add Videos</Button>
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="space-y-6"
        >
          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatTile icon={Car} label="Total Vehicles" value={project.vehicleCount ? formatCompact(project.vehicleCount) : '—'} tone="brand" />
                <StatTile icon={Video} label="Videos" value={String(project.videoCount)} tone="sky" />
                <StatTile icon={FileBarChart} label="Reports" value={String(project.reportCount ?? 0)} tone="violet" />
                <StatTile icon={HardDrive} label="Storage" value={project.storageUsed ? `${project.storageUsed} GB` : '—'} tone="amber" />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Traffic chart */}
                <Card className="lg:col-span-2" padding="md">
                  <CardHeader
                    title="Traffic volume — 24h"
                    subtitle={project.name}
                    icon={<TrendingUp size={16} />}
                  />
                  <div className="mt-5 h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={trafficData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                        <defs>
                          <linearGradient id="detGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="hour" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} interval={3} />
                        <YAxis tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                        <Tooltip content={<DetailTooltip />} />
                        <Area type="monotone" dataKey="vehicles" stroke="#10b981" strokeWidth={2} fill="url(#detGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Vehicle class */}
                <Card padding="md">
                  <CardHeader title="Vehicle Classes" icon={<Car size={16} />} />
                  <div className="mt-4 h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={vehicleClassBreakdown} dataKey="value" nameKey="name" innerRadius={38} outerRadius={56} paddingAngle={3} stroke="none">
                          {vehicleClassBreakdown.map((e) => <Cell key={e.name} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<DetailTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {vehicleClassBreakdown.map((v) => (
                      <div key={v.name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-2 text-ink-300">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: v.color }} /> {v.name}
                        </span>
                        <span className="font-medium text-ink-100">{formatCompact(v.value)}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Recent uploads + jobs */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card padding="md">
                  <CardHeader title="Recent Uploads" icon={<Video size={16} />} action={<Link to="/upload" className="text-xs text-brand-300 hover:text-brand-200">Add more</Link>} />
                  <div className="mt-4 space-y-2">
                    {videos.slice(0, 3).map((v) => (
                      <div key={v.id} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-ink-900/40 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-white/[0.06]">
                          <Film size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink-100">{v.name}</p>
                          <p className="text-xs text-ink-400">{v.duration} · {v.resolution} · {formatBytes(parseFloat(v.size) * 1e9)}</p>
                        </div>
                        <Badge tone={v.status === 'analyzed' ? 'brand' : v.status === 'processing' ? 'sky' : 'amber'}>{v.status}</Badge>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card padding="md">
                  <CardHeader title="Processing Jobs" icon={<Cpu size={16} />} action={job ? <Link to="/processing" className="text-xs text-brand-300 hover:text-brand-200">View</Link> : undefined} />
                  <div className="mt-4 space-y-2">
                    {job ? (
                      <div className="rounded-lg border border-white/[0.05] bg-ink-900/40 p-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-ink-100">{job.stage}</span>
                          <Badge tone="sky" dot pulse>{job.progress}%</Badge>
                        </div>
                        <div className="mt-3"><ProgressBar value={job.progress} size="sm" tone="sky" /></div>
                        <p className="mt-2 text-xs text-ink-400">ETA {job.eta} · {job.fps} FPS</p>
                      </div>
                    ) : (
                      <p className="py-6 text-center text-sm text-ink-400">No active processing jobs.</p>
                    )}
                    <div className="rounded-lg border border-white/[0.05] bg-ink-900/40 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink-100">AI Jobs Run</span>
                        <span className="text-sm text-white">{project.aiJobCount ?? 0}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-400">Total analysis runs for this project</p>
                    </div>
                  </div>
                </Card>
              </div>
            </>
          )}

          {/* VIDEOS */}
          {activeTab === 'videos' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <div key={v.id} className="surface overflow-hidden">
                  <div className="relative aspect-video bg-gradient-to-br from-ink-800/40 to-ink-900/60">
                    <div className="absolute inset-0 bg-grid-faint [background-size:20px_20px] opacity-20" />
                    <button className="absolute inset-0 flex items-center justify-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-transform hover:scale-110">
                        <Play size={16} className="ml-0.5 text-white" fill="white" />
                      </div>
                    </button>
                    <div className="absolute bottom-2 left-2 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300">{v.duration}</div>
                    <div className="absolute right-2 top-2 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300">{v.resolution}</div>
                  </div>
                  <div className="p-4">
                    <p className="truncate text-sm font-medium text-ink-100">{v.name}</p>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-ink-400">
                      <span>{v.fps} FPS</span>
                      <span>{v.size}</span>
                      <span>{v.camera}</span>
                    </div>
                    <div className="mt-3"><Badge tone={v.status === 'analyzed' ? 'brand' : v.status === 'processing' ? 'sky' : 'amber'}>{v.status}</Badge></div>
                  </div>
                </div>
              ))}
              {videos.length === 0 && <p className="col-span-full py-10 text-center text-sm text-ink-400">No videos uploaded yet.</p>}
            </div>
          )}

          {/* REPORTS */}
          {activeTab === 'reports' && (
            <Card padding="none">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left text-xs text-ink-400">
                      <th className="px-5 py-3 font-medium">Report</th>
                      <th className="px-5 py-3 font-medium">Type</th>
                      <th className="px-5 py-3 font-medium">Date</th>
                      <th className="px-5 py-3 font-medium">Vehicles</th>
                      <th className="px-5 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {reports.map((r) => (
                      <tr key={r.id} className="transition-colors hover:bg-white/[0.02]">
                        <td className="px-5 py-4 font-medium text-ink-100">{r.title}</td>
                        <td className="px-5 py-4"><Badge tone="violet">{r.type}</Badge></td>
                        <td className="px-5 py-4 text-ink-300">{formatDate(r.date)}</td>
                        <td className="px-5 py-4 text-ink-300">{formatNumber(r.vehicleCount)}</td>
                        <td className="px-5 py-4 text-right">
                          <Link to="/reports">
                            <button className="flex items-center gap-1 text-xs text-brand-300 hover:text-brand-200">
                              <Download size={13} /> Download
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reports.length === 0 && <p className="py-10 text-center text-sm text-ink-400">No reports generated yet.</p>}
            </Card>
          )}

          {/* ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card padding="md">
                <CardHeader title="Hourly Traffic" icon={<TrendingUp size={16} />} />
                <div className="mt-5 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trafficData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                      <XAxis dataKey="hour" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
                      <YAxis tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <Tooltip content={<DetailTooltip />} />
                      <Bar dataKey="vehicles" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card padding="md">
                <CardHeader title="Vehicle Classes" icon={<Car size={16} />} />
                <div className="mt-5 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vehicleClassBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                      <XAxis type="number" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#aab2c8', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip content={<DetailTooltip />} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                        {vehicleClassBreakdown.map((e) => <Cell key={e.name} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          )}

          {/* TIMELINE */}
          {activeTab === 'timeline' && (
            <Card padding="md">
              <CardHeader title="Processing Timeline" subtitle="Pipeline stages for this project" icon={<Clock size={16} />} />
              <div className="mt-5">
                {timelineStages.map((s, i) => (
                  <div key={s.id} className="flex gap-4 pb-6">
                    {i < timelineStages.length - 1 && (
                      <span className={`absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px ${s.status === 'completed' ? 'bg-brand-500/30' : 'bg-white/[0.06]'}`} style={{ left: 13 }} />
                    )}
                    <div className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                      s.status === 'completed' ? 'bg-brand-500 text-ink-950' :
                      s.status === 'active' ? 'bg-accent-500 text-white ring-4 ring-accent-500/20' :
                      'bg-ink-700 text-ink-400 ring-1 ring-white/[0.06]'
                    }`}>
                      {s.status === 'completed' && <span className="text-xs font-bold">✓</span>}
                      {s.status === 'active' && <span className="h-2 w-2 animate-pulse rounded-full bg-white" />}
                    </div>
                    <div className="pt-1">
                      <div className="text-sm text-ink-100">{s.label}</div>
                      <div className="mt-0.5 text-xs text-ink-400">{s.startedAt} · {s.duration}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* CAMERAS */}
          {activeTab === 'cameras' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((v) => (
                <Card key={v.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-white/[0.06]">
                        <Camera size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-ink-100">{v.camera}</p>
                        <p className="text-xs text-ink-400">{v.resolution} · {v.fps} FPS</p>
                      </div>
                    </div>
                    <Badge tone={v.status === 'analyzed' ? 'brand' : v.status === 'processing' ? 'sky' : 'amber'}>{v.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.04] pt-4 text-xs">
                    <div><span className="text-ink-400">Duration</span><br /><span className="font-medium text-ink-100">{v.duration}</span></div>
                    <div><span className="text-ink-400">File size</span><br /><span className="font-medium text-ink-100">{v.size}</span></div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
            <Card padding="lg" className="mx-auto max-w-xl">
              <CardHeader title="Project Settings" subtitle="Configure analysis parameters" icon={<Settings size={16} />} />
              <div className="mt-5 space-y-4">
                <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-ink-100">Detection model</div>
                      <div className="text-xs text-ink-400">YOLOv8x + ByteTrack</div>
                    </div>
                    <Button variant="secondary" size="sm">Change</Button>
                  </div>
                </div>
                <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-ink-100">Confidence threshold</div>
                      <div className="text-xs text-ink-400">{(project.confidence * 100).toFixed(0)}% (current)</div>
                    </div>
                    <Button variant="secondary" size="sm">Adjust</Button>
                  </div>
                </div>
                <div className="rounded-lg border border-err-500/15 bg-err-500/[0.04] p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-err-400">Delete project</div>
                      <div className="text-xs text-ink-400">Permanently remove this project and all data</div>
                    </div>
                    <Button variant="danger" size="sm">Delete</Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function StatTile({ icon: Icon, label, value, tone }: { icon: typeof Car; label: string; value: string; tone: 'brand' | 'sky' | 'violet' | 'amber' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-500/12 text-brand-300 ring-brand-500/20',
    sky: 'bg-accent-500/12 text-accent-400 ring-accent-500/20',
    violet: 'bg-violet-500/12 text-violet-300 ring-violet-500/20',
    amber: 'bg-warn-500/12 text-warn-400 ring-warn-500/20',
  };
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ${tones[tone]}`}>
          <Icon size={16} />
        </div>
        <div>
          <div className="text-lg font-semibold text-white">{value}</div>
          <div className="text-xs text-ink-400">{label}</div>
        </div>
      </div>
    </Card>
  );
}

function DetailTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: number; name: string; payload: Record<string, string | number> }> }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-ink-850 px-3 py-2 shadow-pop">
      {payload[0].payload.hour && <p className="text-xs font-medium text-white">{payload[0].payload.hour}:00</p>}
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 text-xs text-ink-300">{p.name}: {formatNumber(p.value)}</p>
      ))}
    </div>
  );
}
