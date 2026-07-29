import { Link } from 'react-router-dom';
import { statusTone, statusLabel, thumbnailGradient } from '@/lib/helpers';
import { Badge, ProgressBar } from '@/components/ui';
import { formatCompact, formatNumber, formatRelative } from '@/lib/utils';
import { MapPin, Clock, Video, Film, FileText, Cpu, HardDrive } from 'lucide-react';

interface ProjectCardProps {
  project: import('@/services/project.service').Project;
  to?: string;
  onClick?: () => void;
  compact?: boolean;
  detailed?: boolean;
}

export function ProjectCard({ project, to, onClick, compact, detailed }: ProjectCardProps) {
  const tone = statusTone(project.status);
  const card = (
    <div className="surface surface-hover group w-full overflow-hidden transition-all">
      {/* Thumbnail */}
      <div className={`relative h-28 bg-gradient-to-br ${thumbnailGradient(project.thumbnail)}`}>
        <div className="absolute inset-0 bg-grid-faint [background-size:20px_20px] opacity-40" />
        <div className="absolute left-3 top-3">
          <Badge tone={tone} dot={project.status === 'processing'} pulse={project.status === 'processing'}>
            {statusLabel(project.status)}
          </Badge>
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[11px] text-white/80">
          <span className="flex items-center gap-1 rounded-md bg-ink-950/50 px-2 py-1 backdrop-blur-sm">
            <Video size={11} /> {project.videoCount}
          </span>
          <span className="flex items-center gap-1 rounded-md bg-ink-950/50 px-2 py-1 backdrop-blur-sm">
            <Clock size={11} /> {project.duration}h
          </span>
        </div>
        <div className="absolute bottom-3 right-3 flex items-center gap-1 text-[11px] text-white/60">
          <Film size={11} /> CCTV
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        <h3 className="truncate text-sm font-semibold text-white">{project.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-400">
          <MapPin size={11} /> {project.location}
        </p>

        {!compact && (
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/[0.04] pt-4">
            <Stat label="Vehicles" value={project.vehicleCount ? formatCompact(project.vehicleCount) : '—'} />
            <Stat label="Avg flow" value={project.avgFlow ? `${formatCompact(project.avgFlow)}/h` : '—'} />
            <Stat label="Confidence" value={project.confidence ? `${(project.confidence * 100).toFixed(0)}%` : '—'} />
          </div>
        )}

        {detailed && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-white/[0.04] pt-4">
            <DetailRow icon={FileText} label="Reports" value={String(project.reportCount ?? 0)} />
            <DetailRow icon={Cpu} label="AI Jobs" value={String(project.aiJobCount ?? 0)} />
            <DetailRow icon={HardDrive} label="Storage" value={project.storageUsed ? `${project.storageUsed} GB` : '—'} />
            <DetailRow icon={Clock} label="Updated" value={project.updatedAt ? formatRelative(project.updatedAt) : '—'} />
          </div>
        )}

        {project.status === 'processing' && (
          <div className="mt-4">
            <ProgressBar value={67} size="sm" tone="sky" />
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[11px] text-ink-400">
          <span>{formatRelative(project.createdAt)}</span>
          {project.vehicleCount > 0 && <span>{formatNumber(project.vehicleCount)} total</span>}
        </div>
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block">{card}</Link>;
  }
  if (onClick) {
    return (
      <button onClick={onClick} className="block w-full text-left">
        {card}
      </button>
    );
  }
  return card;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-100">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
      <Icon size={11} className="shrink-0 text-ink-500" />
      <span>{label}</span>
      <span className="ml-auto font-medium text-ink-200">{value}</span>
    </div>
  );
}
