import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { GlobalSearch } from '@/components/shared/GlobalSearch';
import { NotificationPanel } from '@/components/shared/NotificationPanel';
import { ProfileMenu } from '@/components/shared/ProfileMenu';

const titleMap: Record<string, string> = {
  '/': 'Dashboard',
  '/projects': 'Projects',
  '/upload': 'Upload Center',
  '/processing': 'Processing',
  '/reports': 'Reports',
  '/job-queue': 'Job Queue',
  '/billing': 'Billing & Subscription',
  '/support': 'Support',
  '/settings': 'Settings',
  '/profile': 'My Profile',
  '/organization': 'Organization',
};

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const title = titleMap[location.pathname] ?? (location.pathname.startsWith('/projects/') ? 'Project Detail' : 'Johnson Road');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/80 px-4 backdrop-blur-xl lg:px-6">
      <button
        onClick={onMenuClick}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-200 hover:bg-white/[0.06] lg:hidden"
      >
        <Menu size={18} />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-semibold text-white lg:text-base">{title}</h1>
      </div>

      {/* Search */}
      <div className="hidden items-center md:flex">
        <GlobalSearch />
      </div>

      {/* New */}
      <Button size="sm" leftIcon={<Plus size={15} />} className="hidden sm:inline-flex" onClick={() => navigate('/upload')}>
        New Project
      </Button>

      {/* Notifications */}
      <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Profile */}
      <ProfileMenu
        open={profileOpen}
        onToggle={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
        onClose={() => setProfileOpen(false)}
      />
    </header>
  );
}
