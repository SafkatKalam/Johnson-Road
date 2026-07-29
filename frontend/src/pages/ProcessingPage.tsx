import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  Clock,
  Gauge,
  Activity,
  Terminal,
  CheckCircle2,
  Layers,
  Video,
  Film,
  Pause,
  Square,
  Play,
  Monitor,
  MemoryStick,
  HardDrive,
  ListOrdered,
  Eye,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, ProgressBar, Timeline } from '@/components/ui';
import {
  processingJobs,
  processingLogs,
  timelineStages,
  segments,
  type LogEntry,
} from '@/services/processing.service';
import { formatCompact, formatTime } from '@/lib/utils';

const levelTone: Record<LogEntry['level'], string> = {
  info: 'text-ink-300',
  success: 'text-brand-300',
  warn: 'text-warn-400',
  error: 'text-err-400',
};

const levelTag: Record<LogEntry['level'], string> = {
  info: 'INFO',
  success: 'OK  ',
  warn: 'WARN',
  error: 'ERR ',
};

export function ProcessingPage() {
  const activeJob = processingJobs.find((j) => j.status === 'processing') ?? processingJobs[0];
  const [logs, setLogs] = useState<LogEntry[]>(processingLogs);
  const [elapsed, setElapsed] = useState(3628);

  useEffect(() => {
    const messages: Array<{ level: LogEntry['level']; message: string }> = [
      { level: 'info', message: 'Loaded frame 52048/77840 — segment 3/4' },
      { level: 'success', message: 'Tracking 38 vehicles in current frame' },
      { level: 'info', message: 'YOLOv8x inference: 38.4 FPS' },
      { level: 'success', message: 'Vehicle classification updated — car 71%, truck 12%' },
      { level: 'info', message: 'GPU utilization 96% — NVIDIA A100' },
    ];
    const interval = setInterval(() => {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      setLogs((prev) =>
        [{ id: String(Date.now()), time: formatTime((Date.now() / 1000) % 86400), ...msg }, ...prev].slice(0, 40),
      );
      setElapsed((e) => e + 2);
    }, 2400);
    return () => clearInterval(interval);
  }, []);

  const progress = activeJob.progress;

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-white">{activeJob.projectName}</h2>
            <Badge tone="sky" dot pulse>Processing</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-400">
            Stage: {activeJob.stage} · ETA {activeJob.eta} · {activeJob.fps} FPS
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" leftIcon={<Pause size={14} />}>Pause</Button>
          <Button variant="danger" size="sm" leftIcon={<Square size={14} />}>Stop</Button>
        </div>
      </div>

      {/* Live metrics strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricTile label="Progress" value={`${progress}%`} icon={<Activity size={15} />} tone="sky" />
        <MetricTile label="Elapsed" value={formatTime(elapsed)} icon={<Clock size={15} />} tone="brand" />
        <MetricTile label="Vehicles so far" value={formatCompact(activeJob.vehicleCount)} icon={<Film size={15} />} tone="violet" />
        <MetricTile label="Inference speed" value={`${activeJob.fps} FPS`} icon={<Gauge size={15} />} tone="amber" />
      </div>

      {/* Current frame preview + progress */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
                <Cpu size={20} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Current video analysis</h3>
                <p className="text-xs text-ink-400">cam_03_junction_20260725.mp4 · segment 3 of 4</p>
              </div>
            </div>
            <span className="font-mono text-sm text-ink-300">{activeJob.currentFrame} / 18:00:00</span>
          </div>

          {/* Frame preview */}
          <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.08] bg-ink-950/60">
            <div className="relative aspect-video bg-gradient-to-br from-ink-800/40 to-ink-900/60">
              <div className="absolute inset-0 bg-grid-faint [background-size:20px_20px] opacity-20" />
              {/* Simulated detection boxes */}
              {[
                { x: '12%', y: '30%', w: '8%', h: '18%', label: 'car 0.94' },
                { x: '35%', y: '45%', w: '10%', h: '22%', label: 'truck 0.91' },
                { x: '55%', y: '25%', w: '7%', h: '16%', label: 'car 0.97' },
                { x: '70%', y: '50%', w: '9%', h: '20%', label: 'bus 0.88' },
                { x: '85%', y: '35%', w: '6%', h: '14%', label: 'moto 0.82' },
              ].map((box, i) => (
                <motion.div
                  key={i}
                  className="absolute border-2 border-brand-400/70 rounded-sm"
                  style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                >
                  <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-brand-500/80 px-1 text-[9px] font-mono text-ink-950">
                    {box.label}
                  </span>
                </motion.div>
              ))}
              <div className="absolute left-3 top-3 flex items-center gap-2">
                <span className="flex items-center gap-1 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-brand-300 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" /> DETECTING
                </span>
                <span className="rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300 backdrop-blur-sm">
                  Frame 52048/77840
                </span>
              </div>
              <div className="absolute bottom-3 right-3 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300 backdrop-blur-sm">
                38 vehicles tracked
              </div>
              <div className="absolute bottom-3 left-3 flex items-center gap-1 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300 backdrop-blur-sm">
                <Eye size={10} /> Live preview
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-ink-400">Overall progress</span>
              <span className="font-medium text-white">{progress}%</span>
            </div>
            <ProgressBar value={progress} size="lg" tone="sky" />
          </div>
        </Card>

        {/* Resource usage gauges */}
        <Card padding="md">
          <CardHeader title="Resource usage" subtitle="Live system metrics" icon={<Gauge size={16} />} />
          <div className="mt-4 space-y-4">
            <ResourceGauge icon={Cpu} label="GPU" value={94} unit="%" tone="brand" detail="NVIDIA A100" />
            <ResourceGauge icon={Monitor} label="CPU" value={72} unit="%" tone="sky" detail="16 cores" />
            <ResourceGauge icon={MemoryStick} label="Memory" value={68} unit="%" tone="amber" detail="7.2 GB / 10.5 GB" />
            <ResourceGauge icon={HardDrive} label="VRAM" value={85} unit="%" tone="violet" detail="21.3 GB / 25 GB" />
          </div>
          <div className="mt-4 border-t border-white/[0.06] pt-4">
            <div className="flex items-center gap-2 text-xs text-ink-400">
              <ListOrdered size={13} />
              <span>Queue position: <span className="font-medium text-white">1 of 2 jobs</span></span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-400">
              <Clock size={13} />
              <span>Processing speed: <span className="font-medium text-white">{activeJob.fps} FPS</span></span>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Pipeline timeline */}
        <Card padding="md" className="lg:col-span-1">
          <CardHeader title="Processing pipeline" subtitle="Stage-by-stage progress" icon={<Layers size={16} />} />
          <div className="mt-5">
            <Timeline
              items={timelineStages.map((s) => ({
                id: s.id,
                label: s.label,
                meta: (
                  <span className="flex items-center gap-2">
                    <span>{s.startedAt}</span>
                    {s.duration !== '—' && <span>· {s.duration}</span>}
                  </span>
                ),
                status: s.status,
              }))}
            />
          </div>
        </Card>

        {/* Live logs */}
        <Card padding="none" className="lg:col-span-2">
          <CardHeader
            title="Processing logs"
            subtitle="Live stream from AI pipeline"
            icon={<Terminal size={16} />}
            className="border-b border-white/[0.06] px-5 py-4"
            action={
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-brand-400" />
                <span className="text-xs text-ink-400">Live</span>
              </div>
            }
          />
          <div className="h-80 overflow-y-auto bg-ink-950/60 p-4 font-mono text-xs">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex gap-3 py-0.5"
              >
                <span className="shrink-0 text-ink-500">{log.time}</span>
                <span className={`shrink-0 font-semibold ${levelTone[log.level]}`}>{levelTag[log.level]}</span>
                <span className="text-ink-300">{log.message}</span>
              </motion.div>
            ))}
          </div>
        </Card>
      </div>

      {/* Completed segments */}
      <Card padding="md">
        <CardHeader
          title="Video segments"
          subtitle="24-hour footage split into 6-hour segments"
          icon={<Video size={16} />}
        />
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {segments.map((seg) => {
            const tone = seg.status === 'completed' ? 'brand' : seg.status === 'processing' ? 'sky' : 'slate';
            return (
              <div
                key={seg.id}
                className="rounded-xl border border-white/[0.05] bg-ink-900/40 p-4 transition-colors hover:border-white/10"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-ink-300">Segment {seg.id}</span>
                  {seg.status === 'completed' ? (
                    <CheckCircle2 size={15} className="text-brand-400" />
                  ) : seg.status === 'processing' ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                      <Play size={13} className="text-accent-400" />
                    </motion.div>
                  ) : (
                    <Clock size={14} className="text-ink-500" />
                  )}
                </div>
                <div className="mt-3 text-sm font-medium text-ink-100">{seg.range}</div>
                <div className="text-xs text-ink-400">{seg.duration} of footage</div>
                {seg.vehicles > 0 ? (
                  <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
                    <span className="text-xs text-ink-400">Vehicles</span>
                    <span className="text-sm font-semibold text-white">{formatCompact(seg.vehicles)}</span>
                  </div>
                ) : (
                  <div className="mt-3">
                    <ProgressBar value={seg.status === 'processing' ? 45 : 0} size="sm" tone={tone === 'slate' ? 'brand' : 'sky'} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ResourceGauge({ icon: Icon, label, value, unit, tone, detail }: { icon: typeof Cpu; label: string; value: number; unit: string; tone: 'brand' | 'sky' | 'amber' | 'violet'; detail: string }) {
  const tones: Record<string, 'brand' | 'sky' | 'amber' | 'rose'> = {
    brand: 'brand',
    sky: 'sky',
    amber: 'amber',
    violet: 'sky',
  };
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-ink-300">
          <Icon size={13} className="text-ink-400" /> {label}
        </span>
        <span className="font-mono font-semibold text-white">{value}{unit}</span>
      </div>
      <div className="mt-1.5">
        <ProgressBar value={value} size="sm" tone={tones[tone]} />
      </div>
      <p className="mt-1 text-[10px] text-ink-500">{detail}</p>
    </div>
  );
}

function MetricTile({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: 'brand' | 'sky' | 'amber' | 'violet' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-500/12 text-brand-300 ring-brand-500/20',
    sky: 'bg-accent-500/12 text-accent-400 ring-accent-500/20',
    amber: 'bg-warn-500/12 text-warn-400 ring-warn-500/20',
    violet: 'bg-violet-500/12 text-violet-300 ring-violet-500/20',
  };
  return (
    <Card padding="md">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ${tones[tone]}`}>
          {icon}
        </div>
        <div>
          <div className="font-mono text-base font-semibold text-white">{value}</div>
          <div className="text-xs text-ink-400">{label}</div>
        </div>
      </div>
    </Card>
  );
}
