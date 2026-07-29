import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from 'recharts';
import {
  FileBarChart,
  Download,
  FileSpreadsheet,
  FileText,
  Car,
  Clock,
  TrendingUp,
  TrendingDown,
  Gauge,
  MapPin,
  Calendar,
  ChevronDown,
  Share2,
  Printer,
  Check,
  Link2,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, Select } from '@/components/ui';
import {
  trafficVolumeByHour,
  vehicleClassBreakdown,
  weeklyTrafficTrend,
  projects,
} from '@/lib/mockData';
import { formatCompact, formatNumber } from '@/lib/utils';

const peakHours = [
  { hour: '08:00', vehicles: 3762, road: 'A406 East' },
  { hour: '17:30', vehicles: 3648, road: 'A406 East' },
  { hour: '18:00', vehicles: 3412, road: 'A406 East' },
  { hour: '08:15', vehicles: 3290, road: 'Parramatta Rd' },
  { hour: '09:00', vehicles: 2981, road: 'M5 J14' },
];

const hourlyFlow = trafficVolumeByHour.map((d) => ({
  hour: d.hour,
  inbound: Math.round(d.vehicles * 0.52),
  outbound: Math.round(d.vehicles * 0.48),
}));

export function ReportsPage() {
  const [selectedProject, setSelectedProject] = useState('prj_1c9b');
  const project = projects.find((p) => p.id === selectedProject) ?? projects[0];
  const completed = projects.filter((p) => p.status === 'completed');
  const [downloaded, setDownloaded] = useState<string | null>(null);
  const [shared, setShared] = useState(false);

  const handleDownload = (format: string) => {
    setDownloaded(format);
    setTimeout(() => setDownloaded(null), 2500);
  };

  const handleShare = () => {
    setShared(true);
    setTimeout(() => setShared(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Analytics Reports</h2>
          <p className="mt-1 text-sm text-ink-400">Comprehensive traffic analytics for completed analyses.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Printer size={15} />} onClick={handlePrint}>
            Print
          </Button>
          <Button variant="secondary" size="sm" leftIcon={shared ? <Check size={15} /> : <Share2 size={15} />} onClick={handleShare}>
            {shared ? 'Link copied' : 'Share'}
          </Button>
          <Button variant="secondary" size="sm" leftIcon={downloaded === 'excel' ? <Check size={15} /> : <FileSpreadsheet size={15} />} onClick={() => handleDownload('excel')}>
            {downloaded === 'excel' ? 'Downloaded' : 'Excel'}
          </Button>
          <Button size="sm" leftIcon={downloaded === 'pdf' ? <Check size={15} /> : <FileText size={15} />} onClick={() => handleDownload('pdf')}>
            {downloaded === 'pdf' ? 'Downloaded' : 'PDF'}
          </Button>
        </div>
      </div>

      {/* Project selector + summary */}
      <Card padding="lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 text-brand-300 ring-1 ring-brand-500/20">
              <FileBarChart size={22} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">{project.name}</h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-400">
                <span className="flex items-center gap-1"><MapPin size={11} /> {project.location}</span>
                <span className="flex items-center gap-1"><Clock size={11} /> {project.duration}h footage</span>
                <span className="flex items-center gap-1"><Calendar size={11} /> Analyzed Jul 2026</span>
                <Badge tone="brand">Confidence {(project.confidence * 100).toFixed(0)}%</Badge>
              </div>
            </div>
          </div>
          <div className="lg:w-56">
            <Select value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
              {completed.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
              {projects.filter((p) => p.status === 'processing').map((p) => (
                <option key={p.id} value={p.id}>{p.name} (in progress)</option>
              ))}
            </Select>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-6 lg:grid-cols-4">
          <SummaryStat label="Total vehicles" value={formatNumber(project.vehicleCount || 112400)} delta={12.4} up icon={<Car size={15} />} />
          <SummaryStat label="Avg flow rate" value={`${formatCompact(project.avgFlow || 4683)}/h`} delta={5.2} up icon={<Gauge size={15} />} />
          <SummaryStat label="Peak hour" value={project.peakHour === '—' ? '17:30' : project.peakHour} delta={0} icon={<TrendingUp size={15} />} />
          <SummaryStat label="Congestion index" value="6.8 / 10" delta={2.1} up={false} icon={<TrendingDown size={15} />} />
        </div>
      </Card>

      {/* Charts row 1: hourly flow + peak hours */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="md">
          <CardHeader
            title="Hourly traffic flow"
            subtitle="Inbound vs outbound vehicle counts"
            icon={<TrendingUp size={16} />}
            action={
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 text-ink-400"><span className="h-2 w-2 rounded-full bg-brand-400" /> Inbound</span>
                <span className="flex items-center gap-1.5 text-ink-400"><span className="h-2 w-2 rounded-full bg-accent-400" /> Outbound</span>
              </div>
            }
          />
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyFlow} margin={{ top: 6, right: 6, left: -18, bottom: 0 }} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ReportTooltip />} />
                <Bar dataKey="inbound" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={14} />
                <Bar dataKey="outbound" fill="#38bdf8" radius={[3, 3, 0, 0]} maxBarSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="md">
          <CardHeader title="Peak hour analysis" subtitle="Top 5 busiest periods" icon={<Clock size={16} />} />
          <div className="mt-4 space-y-2">
            {peakHours.map((peak, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-white/[0.05] bg-ink-900/40 p-3">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                  i === 0 ? 'bg-brand-500/15 text-brand-300' : 'bg-white/[0.04] text-ink-300'
                }`}>{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-ink-100">{peak.hour}</div>
                  <div className="text-xs text-ink-400">{peak.road}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-white">{formatCompact(peak.vehicles)}</div>
                  <div className="text-[10px] text-ink-400">vehicles</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts row 2: vehicle classes + weekly trend */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card padding="md">
          <CardHeader title="Vehicle class distribution" subtitle="Breakdown by vehicle type" icon={<Car size={16} />} />
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleClassBreakdown} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                <YAxis type="category" dataKey="name" tick={{ fill: '#aab2c8', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<ReportTooltip />} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
                  {vehicleClassBreakdown.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="md">
          <CardHeader title="Weekly traffic trend" subtitle="Total vehicles & peak per day" icon={<TrendingUp size={16} />} />
          <div className="mt-5 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrafficTrend} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="weekGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5d6781', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
                <Tooltip content={<ReportTooltip />} />
                <Area type="monotone" dataKey="vehicles" stroke="#a78bfa" strokeWidth={2} fill="url(#weekGrad)" />
                <Line type="monotone" dataKey="peak" stroke="#fbbf24" strokeWidth={2} dot={{ r: 3, fill: '#fbbf24' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-ink-400"><span className="h-2 w-2 rounded-full bg-violet-400" /> Total vehicles</span>
            <span className="flex items-center gap-1.5 text-ink-400"><span className="h-2 w-2 rounded-full bg-warn-400" /> Peak hour</span>
          </div>
        </Card>
      </div>

      {/* Data table */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Hourly breakdown</h3>
          <Button variant="ghost" size="sm" leftIcon={downloaded === 'csv' ? <Check size={14} /> : <Download size={14} />} onClick={() => handleDownload('csv')}>
            {downloaded === 'csv' ? 'Downloaded' : 'Export CSV'}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-ink-400">
                <th className="px-5 py-3 font-medium">Hour</th>
                <th className="px-5 py-3 font-medium">Total vehicles</th>
                <th className="px-5 py-3 font-medium">Inbound</th>
                <th className="px-5 py-3 font-medium">Outbound</th>
                <th className="px-5 py-3 font-medium">Flow level</th>
                <th className="px-5 py-3 font-medium">Share</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {hourlyFlow.slice(6, 18).map((row, i) => {
                const total = row.inbound + row.outbound;
                const share = ((total / 53000) * 100).toFixed(1);
                const flowLevel = trafficVolumeByHour[i + 6].flow;
                const flowTone = flowLevel === 'peak' ? 'rose' : flowLevel === 'high' ? 'amber' : flowLevel === 'moderate' ? 'sky' : 'slate';
                return (
                  <motion.tr
                    key={row.hour}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3 font-mono text-ink-100">{row.hour}:00</td>
                    <td className="px-5 py-3 font-medium text-white">{formatNumber(total)}</td>
                    <td className="px-5 py-3 text-ink-300">{formatNumber(row.inbound)}</td>
                    <td className="px-5 py-3 text-ink-300">{formatNumber(row.outbound)}</td>
                    <td className="px-5 py-3"><Badge tone={flowTone as 'rose' | 'amber' | 'sky' | 'slate'}>{flowLevel}</Badge></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/[0.06]">
                          <div className="h-full rounded-full bg-brand-500" style={{ width: `${share}%` }} />
                        </div>
                        <span className="text-xs text-ink-400">{share}%</span>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SummaryStat({ label, value, delta, up, icon }: { label: string; value: string; delta: number; up?: boolean; icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-ink-400">
        <span className="text-ink-300">{icon}</span>
        <span className="text-xs">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
      {delta !== 0 && (
        <div className={`mt-1 flex items-center gap-0.5 text-xs ${up ? 'text-brand-300' : 'text-err-400'}`}>
          {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta)}% vs last period
        </div>
      )}
    </div>
  );
}

interface ReportTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; name: string; payload: Record<string, string | number> }>;
}

function ReportTooltip({ active, payload }: ReportTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-ink-850 px-3 py-2 shadow-pop">
      {payload[0].payload.hour && <p className="text-xs font-medium text-white">{payload[0].payload.hour}:00</p>}
      {payload.map((p) => (
        <p key={p.name} className="mt-0.5 text-xs text-ink-300">
          {p.name}: {formatNumber(p.value)}
        </p>
      ))}
    </div>
  );
}
