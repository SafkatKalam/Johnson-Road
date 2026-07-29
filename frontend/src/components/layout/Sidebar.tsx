import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  UploadCloud,
  Cpu,
  FileBarChart,
  Settings,
  LifeBuoy,
  TrafficCone,
  CreditCard,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/upload', label: 'Upload Center', icon: UploadCloud },
  { to: '/processing', label: 'Processing', icon: Cpu },
  { to: '/job-queue', label: 'Job Queue', icon: ListChecks },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
];

const secondary = [
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/support', label: 'Support', icon: LifeBuoy },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/60 lg:flex">
      {/* Brand */}
      <div className="flex h-16 items-center gap-2.5 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-ink-950 shadow-glow">
          <TrafficCone size={18} strokeWidth={2.5} />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-white">Johnson Road</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">
            Traffic Analytics
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          Workspace
        </p>
        {nav.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <p className="px-3 pb-2 pt-6 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
          General
        </p>
        {secondary.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}
      </nav>

      {/* Storage / quota footer */}
      <div className="m-3 rounded-xl border border-white/[0.06] bg-ink-850 p-4">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-ink-200">Compute quota</span>
          <span className="text-ink-400">68%</span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-brand-500 to-accent-500" />
        </div>
        <p className="mt-2 text-[11px] text-ink-400">
          1,360 / 2,000 GPU-hours used this cycle
        </p>
      </div>
    </aside>
  );
}

interface NavItemProps {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}

function NavItem({ to, label, icon: Icon, end }: NavItemProps) {
  return (
    <NavLink to={to} end={end}>
      {({ isActive }) => (
        <motion.div
          className={cn(
            'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive ? 'text-white' : 'text-ink-300 hover:text-white hover:bg-white/[0.04]',
          )}
          whileTap={{ scale: 0.98 }}
        >
          {isActive && (
            <motion.div
              layoutId="nav-active"
              className="absolute inset-0 rounded-lg bg-white/[0.06] ring-1 ring-white/[0.06]"
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            />
          )}
          {isActive && (
            <motion.span
              layoutId="nav-bar"
              className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-400"
            />
          )}
          <Icon size={17} className="relative z-10 shrink-0" strokeWidth={2} />
          <span className="relative z-10 font-medium">{label}</span>
        </motion.div>
      )}
    </NavLink>
  );
}
