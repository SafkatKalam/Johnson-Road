import { useRef, useState, useCallback } from 'react';
import { Eraser, Undo2, MousePointer2 } from 'lucide-react';
import { Button } from '@/components/ui';

interface Point {
  x: number;
  y: number;
}

interface DetectionZoneCanvasProps {
  width?: number;
  height?: number;
  /** A real frame of the uploaded video to draw on. Without it, a placeholder background is shown. */
  imageUrl?: string | null;
  /** Controlled mode: points as fractions of the frame (0 to 1). */
  value?: Point[];
  onChange?: (points: Point[]) => void;
}

export function DetectionZoneCanvas({ width = 480, height = 270, imageUrl, value, onChange }: DetectionZoneCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [own, setOwn] = useState<Point[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);
  const controlled = value !== undefined;
  // Internally the drawing uses view-box units; the controlled value is stored as fractions so it survives resizing.
  const points: Point[] = controlled ? value.map((p) => ({ x: p.x * width, y: p.y * height })) : own;
  const setPoints = useCallback((next: Point[]) => {
    if (controlled) onChange?.(next.map((p) => ({ x: Math.min(1, Math.max(0, p.x / width)), y: Math.min(1, Math.max(0, p.y / height)) })));
    else setOwn(next);
  }, [controlled, onChange, width, height]);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const y = ((e.clientY - rect.top) / rect.height) * height;
    setPoints([...points, { x, y }]);
  }, [width, height, points, setPoints]);

  const undo = () => setPoints(points.slice(0, -1));
  const clear = () => setPoints([]);

  const pathData = points.length > 0
    ? points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + (points.length >= 3 ? ' Z' : '')
    : '';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <MousePointer2 size={13} />
          <span>Click to draw polygon vertices · {points.length} points</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" leftIcon={<Undo2 size={13} />} onClick={undo} disabled={points.length === 0}>
            Undo
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Eraser size={13} />} onClick={clear} disabled={points.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-ink-950/60">
        {imageUrl ? (
          <img src={imageUrl} alt="First frame of the uploaded video" className="absolute inset-0 h-full w-full object-fill" />
        ) : (
          <>
            {/* Simulated video frame */}
            <div className="absolute inset-0 bg-gradient-to-br from-ink-800/40 to-ink-900/60" />
            <div className="absolute inset-0 bg-grid-faint [background-size:24px_24px] opacity-30" />
          </>
        )}
        <div className="absolute left-3 top-3 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300 backdrop-blur-sm">
          {imageUrl ? 'FRAME FROM YOUR VIDEO' : 'CAM-A406-03 · LIVE PREVIEW'}
        </div>

        <svg
          ref={svgRef}
          onClick={handleClick}
          className="relative block w-full cursor-crosshair"
          style={{ aspectRatio: `${width}/${height}` }}
          viewBox={`0 0 ${width} ${height}`}
        >
          {pathData && (
            <>
              <path d={pathData} fill="rgba(16,185,129,0.12)" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 3" />
            </>
          )}
          {points.map((p, i) => (
            <g key={i}>
              <circle
                cx={p.x}
                cy={p.y}
                r={hoveredPoint === i ? 6 : 4}
                fill="#10b981"
                stroke="#0b0d13"
                strokeWidth={1.5}
                onMouseEnter={() => setHoveredPoint(i)}
                onMouseLeave={() => setHoveredPoint(null)}
              />
              <text x={p.x + 8} y={p.y - 8} fill="#a6f3d4" fontSize="10" fontFamily="monospace">{i + 1}</text>
            </g>
          ))}
          {points.length === 0 && (
            <text x={width / 2} y={height / 2} fill="#5d6781" fontSize="13" textAnchor="middle" fontFamily="sans-serif">
              Click to define detection region
            </text>
          )}
        </svg>
      </div>

      {points.length >= 3 && (
        <div className="rounded-lg border border-brand-500/20 bg-brand-500/[0.06] px-3 py-2 text-xs text-brand-300">
          Detection zone defined with {points.length} vertices. Vehicles inside this polygon will be counted.
        </div>
      )}
    </div>
  );
}
