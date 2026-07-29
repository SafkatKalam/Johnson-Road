import { Play, Clock, Monitor, Film, HardDrive } from 'lucide-react';

interface VideoPreviewProps {
  name: string;
  duration: string;
  resolution: string;
  fps: number;
  size: string;
}

export function VideoPreview({ name, duration, resolution, fps, size }: VideoPreviewProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900/40">
      {/* Thumbnail / player */}
      <div className="relative aspect-video bg-gradient-to-br from-ink-800/40 to-ink-900/60">
        <div className="absolute inset-0 bg-grid-faint [background-size:20px_20px] opacity-20" />
        <button className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm ring-1 ring-white/20 transition-transform hover:scale-110">
            <Play size={20} className="ml-0.5 text-white" fill="white" />
          </div>
        </button>
        <div className="absolute bottom-2 left-2 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300 backdrop-blur-sm">
          {duration}
        </div>
        <div className="absolute right-2 top-2 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300 backdrop-blur-sm">
          {resolution}
        </div>
      </div>

      {/* Details */}
      <div className="p-3">
        <p className="truncate text-xs font-medium text-ink-100">{name}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-400">
          <span className="flex items-center gap-1"><Clock size={10} /> {duration}</span>
          <span className="flex items-center gap-1"><Monitor size={10} /> {resolution}</span>
          <span className="flex items-center gap-1"><Film size={10} /> {fps} FPS</span>
          <span className="flex items-center gap-1"><HardDrive size={10} /> {size}</span>
        </div>
      </div>
    </div>
  );
}
