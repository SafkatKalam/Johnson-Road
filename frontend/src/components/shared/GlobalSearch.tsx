import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FolderKanban, FileBarChart, Cpu, UploadCloud, BarChart3, Settings, Command, X } from 'lucide-react';
import { VideoSetupService } from '@/services/videoSetup.service';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  label: string;
  category: 'Projects' | 'Reports' | 'Processing' | 'Uploads' | 'Analytics' | 'Settings';
  to: string;
  icon: string;
}

// Pages are always searchable; projects and reports come from the server (your organisation only).
const PAGES: SearchResult[] = [
  { id: 'p-upload', label: 'Upload a video', category: 'Uploads', to: '/upload', icon: 'upload' },
  { id: 'p-queue', label: 'Job Queue', category: 'Processing', to: '/job-queue', icon: 'cpu' },
  { id: 'p-processing', label: 'Processing (live)', category: 'Processing', to: '/processing', icon: 'cpu' },
  { id: 'p-reports', label: 'All reports', category: 'Reports', to: '/reports', icon: 'file' },
  { id: 'p-dashboard', label: 'Dashboard', category: 'Analytics', to: '/', icon: 'chart' },
  { id: 'p-org', label: 'Organization and members', category: 'Settings', to: '/organization', icon: 'settings' },
  { id: 'p-settings', label: 'Settings', category: 'Settings', to: '/settings', icon: 'settings' },
];

const iconMap: Record<string, typeof FolderKanban> = {
  folder: FolderKanban,
  file: FileBarChart,
  cpu: Cpu,
  upload: UploadCloud,
  chart: BarChart3,
  settings: Settings,
};

const categoryOrder: SearchResult['category'][] = ['Projects', 'Reports', 'Processing', 'Uploads', 'Analytics', 'Settings'];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setActiveIndex(0);
    }
  }, [open]);

  const [remote, setRemote] = useState<SearchResult[]>([]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(async () => {
      const q = query.trim();
      try {
        const [projects, reports] = await Promise.all([
          VideoSetupService.listProjects({ q: q || undefined, state: 'all', limit: 8 }),
          VideoSetupService.listReports({ limit: 50 }),
        ]);
        if (!alive) return;
        const ql = q.toLowerCase();
        setRemote([
          ...projects.items.map((p): SearchResult => ({ id: `prj-${p.id}`, label: p.location ? `${p.name} — ${p.location}` : p.name, category: 'Projects', to: `/projects/${p.id}`, icon: 'folder' })),
          ...reports.items.filter((r) => !ql || r.title.toLowerCase().includes(ql)).slice(0, 6)
            .map((r): SearchResult => ({ id: `rep-${r.id}`, label: `${r.title} (v${r.version})`, category: 'Reports', to: `/reports?report=${r.id}`, icon: 'file' })),
        ]);
      } catch {
        if (alive) setRemote([]);
      }
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [query, open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pages = !q ? PAGES : PAGES.filter((r) => r.label.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
    return [...remote, ...pages];
  }, [query, remote]);

  const grouped = useMemo(() => {
    const g: Record<string, SearchResult[]> = {};
    results.forEach((r) => {
      if (!g[r.category]) g[r.category] = [];
      g[r.category].push(r);
    });
    return g;
  }, [results]);

  const flatResults = useMemo(
    () => categoryOrder.flatMap((c) => grouped[c] ?? []),
    [grouped],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectResult = (r: SearchResult) => {
    navigate(r.to);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatResults[activeIndex]) selectResult(flatResults[activeIndex]);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group flex h-9 w-56 items-center gap-2 rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 text-sm text-ink-400 transition-colors hover:border-white/15 hover:text-ink-300"
      >
        <Search size={15} />
        <span>Search everything…</span>
        <kbd className="ml-auto flex items-center gap-0.5 rounded border border-white/10 px-1.5 text-[10px] text-ink-400">
          <Command size={10} />K
        </kbd>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm" onClick={() => setOpen(false)} />
            <motion.div
              className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/[0.08] bg-ink-850 shadow-pop"
              initial={{ scale: 0.97, opacity: 0, y: -8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.97, opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
                <Search size={18} className="text-ink-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search projects, reports, processing jobs…"
                  className="flex-1 bg-transparent text-sm text-white placeholder:text-ink-400 focus:outline-none"
                />
                {query && (
                  <button onClick={() => setQuery('')} className="text-ink-400 hover:text-white">
                    <X size={15} />
                  </button>
                )}
                <kbd className="rounded border border-white/10 px-1.5 text-[10px] text-ink-400">ESC</kbd>
              </div>

              <div className="max-h-[50vh] overflow-y-auto p-2">
                {flatResults.length === 0 ? (
                  <div className="px-3 py-8 text-center text-sm text-ink-400">No results for "{query}"</div>
                ) : (
                  categoryOrder.map((category) => {
                    const items = grouped[category];
                    if (!items || items.length === 0) return null;
                    return (
                      <div key={category} className="mb-1">
                        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">{category}</p>
                        {items.map((r) => {
                          const Icon = iconMap[r.icon] ?? FolderKanban;
                          const flatIdx = flatResults.indexOf(r);
                          return (
                            <button
                              key={r.id}
                              onClick={() => selectResult(r)}
                              onMouseEnter={() => setActiveIndex(flatIdx)}
                              className={cn(
                                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                                activeIndex === flatIdx ? 'bg-white/[0.06] text-white' : 'text-ink-200 hover:bg-white/[0.03]',
                              )}
                            >
                              <Icon size={15} className="shrink-0 text-ink-400" />
                              <span className="flex-1 truncate">{r.label}</span>
                              <span className="text-[10px] text-ink-500">{r.to}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
