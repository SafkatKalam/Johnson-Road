import { useMemo, useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Plus,
  SlidersHorizontal,
  LayoutGrid,
  List,
  FolderKanban,
  MapPin,
  Car,
  Clock,
  Film,
  X,
  Check,
} from 'lucide-react';
import { ProjectCard } from '@/components/shared/ProjectCard';
import { Card, CardHeader, Button, Input, Badge, Modal, Select, EmptyState } from '@/components/ui';
import { projects as allProjects, locationSuggestions, type ProjectStatus } from '@/lib/mockData';
import { statusTone, statusLabel, thumbnailGradient } from '@/lib/helpers';
import { formatCompact, formatNumber, formatRelative, formatDate } from '@/lib/utils';

const filters: { key: ProjectStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'processing', label: 'Processing' },
  { key: 'queued', label: 'Queued' },
  { key: 'failed', label: 'Failed' },
];

export function ProjectsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showNew, setShowNew] = useState(false);
  const [sort, setSort] = useState('recent');

  // Create project form state
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [locationFocused, setLocationFocused] = useState(false);
  const [roadType, setRoadType] = useState('Highway');
  const [model, setModel] = useState('yolov8x');
  const [classes, setClasses] = useState('all');
  const locRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    let list = allProjects.filter((p) => {
      const matchesQuery =
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.location.toLowerCase().includes(query.toLowerCase());
      const matchesFilter = filter === 'all' || p.status === filter;
      return matchesQuery && matchesFilter;
    });
    if (sort === 'recent') list = [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (sort === 'vehicles') list = [...list].sort((a, b) => b.vehicleCount - a.vehicleCount);
    if (sort === 'duration') list = [...list].sort((a, b) => b.duration - a.duration);
    return list;
  }, [query, filter, sort]);

  const stats = useMemo(
    () => ({
      total: allProjects.length,
      completed: allProjects.filter((p) => p.status === 'completed').length,
      processing: allProjects.filter((p) => p.status === 'processing').length,
      vehicles: allProjects.reduce((sum, p) => sum + p.vehicleCount, 0),
    }),
    [],
  );

  const filteredLocations = useMemo(() => {
    if (!location.trim()) return locationSuggestions.slice(0, 5);
    return locationSuggestions
      .filter((s) => s.toLowerCase().includes(location.toLowerCase()))
      .slice(0, 5);
  }, [location]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowNew(false);
    navigate('/upload');
  };

  const selectLocation = (s: string) => {
    setLocation(s);
    setLocationFocused(false);
  };

  return (
    <div className="space-y-6">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total projects" value={String(stats.total)} icon={FolderKanban} />
        <StatTile label="Completed" value={String(stats.completed)} icon={Film} tone="brand" />
        <StatTile label="In progress" value={String(stats.processing)} icon={Clock} tone="sky" />
        <StatTile label="Vehicles analyzed" value={formatCompact(stats.vehicles)} icon={Car} tone="violet" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name or location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search size={15} />}
            rightSlot={query ? <ClearButton onClick={() => setQuery('')} /> : undefined}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto">
            <option value="recent">Most recent</option>
            <option value="vehicles">Most vehicles</option>
            <option value="duration">Longest footage</option>
          </Select>
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-ink-900/60 p-0.5">
            <ViewToggle active={view === 'grid'} onClick={() => setView('grid')} icon={<LayoutGrid size={15} />} />
            <ViewToggle active={view === 'list'} onClick={() => setView('list')} icon={<List size={15} />} />
          </div>
          <Button leftIcon={<Plus size={15} />} onClick={() => setShowNew(true)}>
            New Project
          </Button>
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <SlidersHorizontal size={14} className="shrink-0 text-ink-400" />
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-white/[0.08] text-white ring-1 ring-white/10'
                : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-ink-500">
              {f.key === 'all' ? allProjects.length : allProjects.filter((p) => p.status === f.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={FolderKanban}
            title="No projects found"
            description="Try adjusting your search or filters, or start a new project by uploading CCTV footage."
            action={
              <Button leftIcon={<Plus size={15} />} onClick={() => setShowNew(true)}>
                New Project
              </Button>
            }
          />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
              >
                <ProjectCard project={p} to={`/projects/${p.id}`} detailed />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] text-left text-xs text-ink-400">
                  <th className="px-5 py-3 font-medium">Project</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Footage</th>
                  <th className="px-5 py-3 font-medium">Vehicles</th>
                  <th className="px-5 py-3 font-medium">Confidence</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br ${thumbnailGradient(p.thumbnail)}`} />
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink-100">{p.name}</div>
                          <div className="flex items-center gap-1 text-xs text-ink-400">
                            <MapPin size={10} /> {p.location}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge tone={statusTone(p.status)} dot={p.status === 'processing'} pulse={p.status === 'processing'}>
                        {statusLabel(p.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-ink-300">{p.duration}h · {p.videoCount} videos</td>
                    <td className="px-5 py-4 text-ink-300">{p.vehicleCount ? formatNumber(p.vehicleCount) : '—'}</td>
                    <td className="px-5 py-4 text-ink-300">{p.confidence ? `${(p.confidence * 100).toFixed(0)}%` : '—'}</td>
                    <td className="px-5 py-4 text-ink-400">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-4 text-ink-400">{p.updatedAt ? formatRelative(p.updatedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New project modal with autocomplete */}
      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        title="Create new project"
        description="Set up a new traffic analysis project. You can upload footage next."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button onClick={() => { setShowNew(false); navigate('/upload'); }}>Create project</Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <Input
            label="Project name"
            placeholder="e.g. A406 North Circular — East"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            {/* Autocomplete location */}
            <div className="relative">
              <label className="mb-1.5 block text-xs font-medium text-ink-200">Location</label>
              <div className="relative flex items-center">
                <MapPin size={15} className="pointer-events-none absolute left-3 text-ink-300" />
                <input
                  ref={locRef}
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onFocus={() => setLocationFocused(true)}
                  onBlur={() => setTimeout(() => setLocationFocused(false), 150)}
                  placeholder="City, Country"
                  className="h-9 w-full rounded-lg border border-white/[0.08] bg-ink-900/60 pl-9 pr-3 text-sm text-ink-50 placeholder:text-ink-400 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
              <AnimatePresence>
                {locationFocused && filteredLocations.length > 0 && (
                  <motion.div
                    className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-ink-850 shadow-pop"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.12 }}
                  >
                    {filteredLocations.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); selectLocation(s); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-200 transition-colors hover:bg-white/[0.06]"
                      >
                        <MapPin size={13} className="text-ink-400" />
                        {s}
                        {s === location && <Check size={13} className="ml-auto text-brand-400" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Select label="Road type" value={roadType} onChange={(e) => setRoadType(e.target.value)}>
              <option>Highway</option>
              <option>Arterial</option>
              <option>Urban</option>
              <option>Junction</option>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label="Analysis model" value={model} onChange={(e) => setModel(e.target.value)}>
              <option value="yolov8x">YOLOv8x + ByteTrack</option>
              <option value="yolov8l">YOLOv8l + BoT-SORT</option>
              <option value="custom">Custom model</option>
            </Select>
            <Select label="Detection classes" value={classes} onChange={(e) => setClasses(e.target.value)}>
              <option value="all">All vehicles</option>
              <option value="cars">Cars only</option>
              <option value="hgv">HGV + buses</option>
            </Select>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-3 text-xs text-ink-400">
            Press <kbd className="rounded border border-white/10 px-1 font-mono">Enter</kbd> to create this project and proceed to upload.
          </div>
          {/* Hidden submit button for Enter key */}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, tone = 'slate' }: { label: string; value: string; icon: typeof FolderKanban; tone?: 'brand' | 'sky' | 'violet' | 'slate' }) {
  const tones: Record<string, string> = {
    slate: 'bg-white/[0.04] text-ink-200 ring-white/[0.06]',
    brand: 'bg-brand-500/12 text-brand-300 ring-brand-500/20',
    sky: 'bg-accent-500/12 text-accent-400 ring-accent-500/20',
    violet: 'bg-violet-500/12 text-violet-300 ring-violet-500/20',
  };
  return (
    <Card padding="sm">
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

function ViewToggle({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        active ? 'bg-white/[0.08] text-white' : 'text-ink-400 hover:text-white'
      }`}
    >
      {icon}
    </button>
  );
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:text-white">
      <X size={13} />
    </button>
  );
}
