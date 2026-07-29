import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FolderKanban,
  UploadCloud,
  Cpu,
  FileBarChart,
  TrafficCone,
  X,
  ListChecks,
  CreditCard,
  LifeBuoy,
  Settings,
} from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const mobileNav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/upload', label: 'Upload Center', icon: UploadCloud },
  { to: '/processing', label: 'Processing', icon: Cpu },
  { to: '/job-queue', label: 'Job Queue', icon: ListChecks },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/support', label: 'Support', icon: LifeBuoy },
];

export function Layout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="relative flex h-screen overflow-hidden bg-ink-950">
      {/* Ambient background */}
      <div className="pointer-events-none fixed inset-0 bg-grid-faint [background-size:40px_40px]" />
      <div className="pointer-events-none fixed inset-0 bg-radial-fade" />

      <Sidebar />

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink-950/70 backdrop-blur-sm lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-white/[0.06] bg-ink-900 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            >
              <div className="flex h-16 items-center justify-between px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-ink-950">
                    <TrafficCone size={18} strokeWidth={2.5} />
                  </div>
                  <span className="text-sm font-semibold text-white">Johnson Road</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-ink-300 hover:text-white">
                  <X size={18} />
                </button>
              </div>
              <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
                {mobileNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-white/[0.06] text-white'
                          : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
                      }`
                    }
                  >
                    <item.icon size={17} />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="relative flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
