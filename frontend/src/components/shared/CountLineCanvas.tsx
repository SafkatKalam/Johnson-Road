import { useRef, useState, useCallback } from 'react';
import { Eraser, Undo2, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui';

interface LinePoint {
  x: number;
  y: number;
}

interface CountLine {
  id: number;
  start: LinePoint;
  end: LinePoint;
  direction: 'forward' | 'backward';
}

interface CountLineCanvasProps {
  width?: number;
  height?: number;
}

export function CountLineCanvas({ width = 480, height = 270 }: CountLineCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [lines, setLines] = useState<CountLine[]>([]);
  const [drawingStart, setDrawingStart] = useState<LinePoint | null>(null);
  const [hoverPos, setHoverPos] = useState<LinePoint | null>(null);

  const toSvgCoords = useCallback((e: React.MouseEvent<SVGSVGElement>): LinePoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * width,
      y: ((e.clientY - rect.top) / rect.height) * height,
    };
  }, [width, height]);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (drawingStart) return;
    setDrawingStart(toSvgCoords(e));
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    setHoverPos(toSvgCoords(e));
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!drawingStart) return;
    const end = toSvgCoords(e);
    const dx = Math.abs(end.x - drawingStart.x);
    const dy = Math.abs(end.y - drawingStart.y);
    if (dx > 8 || dy > 8) {
      setLines((prev) => [
        ...prev,
        { id: Date.now(), start: drawingStart, end, direction: 'forward' },
      ]);
    }
    setDrawingStart(null);
  };

  const toggleDirection = (id: number) => {
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, direction: l.direction === 'forward' ? 'backward' : 'forward' } : l)),
    );
  };

  const undo = () => setLines((prev) => prev.slice(0, -1));
  const clear = () => setLines([]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-ink-400">
          <span>Click & drag to draw counting lines · {lines.length} line(s)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" leftIcon={<Undo2 size={13} />} onClick={undo} disabled={lines.length === 0}>
            Undo
          </Button>
          <Button variant="ghost" size="sm" leftIcon={<Eraser size={13} />} onClick={clear} disabled={lines.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-ink-950/60">
        <div className="absolute inset-0 bg-gradient-to-br from-ink-800/40 to-ink-900/60" />
        <div className="absolute inset-0 bg-grid-faint [background-size:24px_24px] opacity-30" />
        <div className="absolute left-3 top-3 rounded bg-ink-950/60 px-2 py-0.5 text-[10px] font-mono text-ink-300 backdrop-blur-sm">
          CAM-A406-03 · LIVE PREVIEW
        </div>

        <svg
          ref={svgRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => { setHoverPos(null); setDrawingStart(null); }}
          className="relative block w-full cursor-crosshair"
          style={{ aspectRatio: `${width}/${height}` }}
          viewBox={`0 0 ${width} ${height}`}
        >
          {/* Existing lines */}
          {lines.map((line) => {
            const midX = (line.start.x + line.end.x) / 2;
            const midY = (line.start.y + line.end.y) / 2;
            const angle = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
            return (
              <g key={line.id} className="cursor-pointer" onClick={() => toggleDirection(line.id)}>
                <line
                  x1={line.start.x}
                  y1={line.start.y}
                  x2={line.end.x}
                  y2={line.end.y}
                  stroke="#fbbf24"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                />
                <circle cx={line.start.x} cy={line.start.y} r={4} fill="#fbbf24" stroke="#0b0d13" strokeWidth={1} />
                <circle cx={line.end.x} cy={line.end.y} r={4} fill="#fbbf24" stroke="#0b0d13" strokeWidth={1} />
                {/* Direction arrow */}
                <g
                  transform={`translate(${midX}, ${midY}) rotate(${(angle * 180) / Math.PI + (line.direction === 'backward' ? 180 : 0)})`}
                  onClick={(e) => { e.stopPropagation(); toggleDirection(line.id); }}
                >
                  <polygon points="0,-5 8,0 0,5" fill="#fbbf24" />
                  <text x="12" y="3" fill="#fbbf24" fontSize="9" fontFamily="monospace">{line.direction === 'forward' ? '→' : '←'}</text>
                </g>
                <text x={midX - 12} y={midY - 10} fill="#fde68a" fontSize="9" fontFamily="monospace">Line {lines.indexOf(line) + 1}</text>
              </g>
            );
          })}

          {/* Currently drawing line */}
          {drawingStart && hoverPos && (
            <line
              x1={drawingStart.x}
              y1={drawingStart.y}
              x2={hoverPos.x}
              y2={hoverPos.y}
              stroke="#fbbf24"
              strokeWidth={2}
              strokeDasharray="6 3"
              opacity={0.6}
            />
          )}

          {lines.length === 0 && !drawingStart && (
            <text x={width / 2} y={height / 2} fill="#5d6781" fontSize="13" textAnchor="middle" fontFamily="sans-serif">
              Click and drag to draw a counting line
            </text>
          )}
        </svg>
      </div>

      {lines.length > 0 && (
        <div className="space-y-2">
          <div className="rounded-lg border border-warn-500/20 bg-warn-500/[0.06] px-3 py-2 text-xs text-warn-400">
            {lines.length} counting line(s) defined. Click a line to toggle traffic direction.
          </div>
          <div className="flex flex-wrap gap-2">
            {lines.map((line, i) => (
              <button
                key={line.id}
                onClick={() => toggleDirection(line.id)}
                className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-ink-900/40 px-2.5 py-1 text-xs text-ink-200 transition-colors hover:border-white/10"
              >
                <span className="text-warn-400">Line {i + 1}</span>
                {line.direction === 'forward' ? <ArrowRight size={12} className="text-warn-400" /> : <ArrowLeft size={12} className="text-warn-400" />}
                <span className="text-ink-400">{line.direction}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
