import { useMemo, useState, useEffect, useCallback } from 'react';
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
  Film,
  FileText,
  Cpu,
  X,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Card, Button, Input, Badge, Modal, Select, EmptyState } from '@/components/ui';
import { VideoSetupService, describeSetupError, type ProjectItem } from '@/services/videoSetup.service';
import { formatRelative, formatDate } from '@/lib/utils';

type StateFilter = 'active' | 'archived' | 'all';
const filters: { key: StateFilter; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'archived', label: 'Archived' },
  { key: 'all', label: 'All' },
];

export function ProjectsPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StateFilter>('active');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showNew, setShowNew] = useState(false);
  const [sort, setSort] = useState('recent');
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  // Create project form state
  const [projectName, setProjectName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [locationFocused, setLocationFocused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = useCallback(async (q: string, state: StateFilter) => {
    try {
      const page = await VideoSetupService.listProjects({ q: q.trim() || undefined, state, limit: 100 });
      setItems(page.items);
      setTotal(page.total);
      setError('');
    } catch (e) {
      setError(describeSetupError(e));
    } finally {
      setLoaded(true);
    }
  }, []);

  // Search runs on the server (name or location), shortly after typing stops.
  useEffect(() => {
    const t = setTimeout(() => load(query, filter), 250);
    return () => clearTimeout(t);
  }, [query, filter, load]);

  useEffect(() => {
    if (!showNew) return;
    const t = setTimeout(() => {
      VideoSetupService.locationSuggestions(location.trim() || undefined).then(setSuggestions).catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [location, showNew]);

  const sorted = useMemo(() => {
    const list = [...items];
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'videos') list.sort((a, b) => b.uploadCount - a.uploadCount);
    return list; // 'recent' is the server's order
  }, [items, sort]);

  const stats = useMemo(() => ({
    total,
    videos: items.reduce((s, p) => s + p.uploadCount, 0),
    jobs: items.reduce((s, p) => s + p.jobCount, 0),
    reports: items.reduce((s, p) => s + p.reportCount, 0),
  }), [items, total]);

  const closeNew = () => {
    setShowNew(false);
    setProjectName('');
    setLocation('');
    setDescription('');
    setCreateError('');
  };

  const handleCreateSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (creating) return;
    if (!projectName.trim()) { setCreateError('Project name is required.'); return; }
    setCreating(true);
    setCreateError('');
    try {
      const p = await VideoSetupService.createProject({ name: projectName.trim(), location: location.trim(), description: description.trim() });
      closeNew();
      navigate(`/projects/${p.id}`);
    } catch (err) {
      setCreateError(describeSetupError(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats strip: counted from stored records */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label={filter === 'archived' ? 'Archived projects' : filter === 'all' ? 'All projects' : 'Active projects'} value={String(stats.total)} icon={FolderKanban} />
        <StatTile label="Videos" value={String(stats.videos)} icon={Film} tone="brand" />
        <StatTile label="Analysis jobs" value={String(stats.jobs)} icon={Cpu} tone="sky" />
        <StatTile label="Reports" value={String(stats.reports)} icon={FileText} tone="violet" />
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            placeholder="Search by name or location…"
            aria-label="Search projects"
            value={query}
            maxLength={120}
            onChange={(e) => setQuery(e.target.value)}
            leftIcon={<Search size={15} />}
            rightSlot={query ? <ClearButton onClick={() => setQuery('')} /> : undefined}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-auto" aria-label="Sort projects">
            <option value="recent">Most recent</option>
            <option value="name">Name</option>
            <option value="videos">Most videos</option>
          </Select>
          <div className="flex items-center rounded-lg border border-white/[0.08] bg-ink-900/60 p-0.5">
            <ViewToggle label="Grid view" active={view === 'grid'} onClick={() => setView('grid')} icon={<LayoutGrid size={15} />} />
            <ViewToggle label="List view" active={view === 'list'} onClick={() => setView('list')} icon={<List size={15} />} />
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
            aria-pressed={filter === f.key}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
              filter === f.key
                ? 'bg-white/[0.08] text-white ring-1 ring-white/10'
                : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {!loaded ? (
        <Card padding="lg"><p className="flex items-center gap-2 text-sm text-ink-400"><Loader2 size={15} className="animate-spin" /> Loading projects…</p></Card>
      ) : sorted.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={FolderKanban}
            title={query ? 'No projects found' : filter === 'archived' ? 'No archived projects' : 'No projects yet'}
            description={query ? 'Try another name or location.' : 'Create a project, then upload CCTV footage to it.'}
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
            {sorted.map((p, i) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25, delay: Math.min(i, 8) * 0.04 }}
              >
                <Card padding="md" hover onClick={() => navigate(`/projects/${p.id}`)}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-white">{p.name}</p>
                    {p.archived && <Badge tone="slate">Archived</Badge>}
                  </div>
                  <p className="mt-1 flex items-center gap-1 truncate text-xs text-ink-400"><MapPin size={11} /> {p.location || 'No location'}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Videos" value={p.uploadCount} />
                    <Mini label="Jobs" value={p.jobCount} />
                    <Mini label="Reports" value={p.reportCount} />
                  </div>
                  <p className="mt-3 text-[11px] text-ink-500">Updated {formatRelative(p.updatedAt)}</p>
                </Card>
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
                  <th className="px-5 py-3 font-medium">State</th>
                  <th className="px-5 py-3 font-medium">Videos</th>
                  <th className="px-5 py-3 font-medium">Jobs</th>
                  <th className="px-5 py-3 font-medium">Reports</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {sorted.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => navigate(`/projects/${p.id}`)}
                    className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-ink-100">{p.name}</div>
                        <div className="flex items-center gap-1 text-xs text-ink-400">
                          <MapPin size={10} /> {p.location || 'No location'}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><Badge tone={p.archived ? 'slate' : 'brand'}>{p.archived ? 'Archived' : 'Active'}</Badge></td>
                    <td className="px-5 py-4 text-ink-300">{p.uploadCount}</td>
                    <td className="px-5 py-4 text-ink-300">{p.jobCount}</td>
                    <td className="px-5 py-4 text-ink-300">{p.reportCount}</td>
                    <td className="px-5 py-4 text-ink-400">{formatDate(p.createdAt)}</td>
                    <td className="px-5 py-4 text-ink-400">{formatRelative(p.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* New project modal */}
      <Modal
        open={showNew}
        onClose={closeNew}
        title="Create new project"
        description="Set up a new traffic analysis project. You can upload footage next."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={closeNew}>Cancel</Button>
            <Button onClick={() => handleCreateSubmit()} disabled={creating} leftIcon={creating ? <Loader2 size={15} className="animate-spin" /> : undefined}>
              {creating ? 'Creating…' : 'Create project'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div role="alert" className="rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">{createError}</div>
          )}
          <Input
            label="Project name"
            placeholder="e.g. A406 North Circular — East"
            maxLength={120}
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
          />
          {/* Location with suggestions from your organisation's existing projects */}
          <div className="relative">
            <label htmlFor="new-project-location" className="mb-1.5 block text-xs font-medium text-ink-200">Location</label>
            <div className="relative flex items-center">
              <MapPin size={15} className="pointer-events-none absolute left-3 text-ink-300" />
              <input
                id="new-project-location"
                type="text"
                maxLength={200}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onFocus={() => setLocationFocused(true)}
                onBlur={() => setTimeout(() => setLocationFocused(false), 150)}
                placeholder="City, Country"
                className="h-9 w-full rounded-lg border border-white/[0.08] bg-ink-900/60 pl-9 pr-3 text-sm text-ink-50 placeholder:text-ink-400 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </div>
            <AnimatePresence>
              {locationFocused && suggestions.length > 0 && (
                <motion.div
                  className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-white/[0.08] bg-ink-850 shadow-pop"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.12 }}
                >
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); setLocation(s); setLocationFocused(false); }}
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
          <div>
            <label htmlFor="new-project-description" className="mb-1.5 block text-xs font-medium text-ink-200">Description (optional)</label>
            <textarea
              id="new-project-description"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-400 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-3 text-xs text-ink-400">
            Analysis settings are chosen per video in the Upload Center. Press <kbd className="rounded border border-white/10 px-1 font-mono">Enter</kbd> to create this project.
          </div>
          {/* Hidden submit button for Enter key */}
          <button type="submit" className="hidden" />
        </form>
      </Modal>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white/[0.03] py-1.5">
      <div className="text-sm font-semibold text-white">{value}</div>
      <div className="text-[10px] text-ink-400">{label}</div>
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

function ViewToggle({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
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
    <button onClick={onClick} aria-label="Clear search" className="flex h-5 w-5 items-center justify-center rounded text-ink-400 hover:text-white">
      <X size={13} />
    </button>
  );
}
