import { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Building2,
  CreditCard,
  Settings,
  LifeBuoy,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

const menuItems = [
  { label: 'My Profile', icon: User, to: '/profile' },
  { label: 'Organizations', icon: Building2, to: '/organization' },
  { label: 'Billing', icon: CreditCard, to: '/billing' },
  { label: 'Settings', icon: Settings, to: '/settings' },
  { label: 'Help & Support', icon: LifeBuoy, to: '/support' },
];

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

interface ProfileMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function ProfileMenu({ open, onToggle, onClose }: ProfileMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, profile, organization, signOut } = useAuth();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose]);

  const handleNavigate = (to: string) => {
    navigate(to);
    onClose();
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
    onClose();
  };

  const displayName = profile?.full_name || user?.email || 'User';
  const roleLabel = profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) : 'Researcher';
  const orgName = organization?.name || 'No organization';

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-white/[0.06]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-xs font-bold text-ink-950">
          {getInitials(displayName)}
        </div>
        <div className="hidden text-left sm:block">
          <div className="text-xs font-semibold text-white">{displayName}</div>
          <div className="text-[10px] text-ink-400">{roleLabel}</div>
        </div>
        <ChevronDown size={14} className="hidden text-ink-300 sm:block" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute right-0 top-11 z-50 w-64 overflow-hidden rounded-xl border border-white/[0.08] bg-ink-850 shadow-pop"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
          >
            {/* Profile summary — only name, org, role, avatar */}
            <div className="border-b border-white/[0.06] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-sm font-bold text-ink-950">
                  {getInitials(displayName)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-white">{displayName}</div>
                  <div className="truncate text-xs text-ink-400">{orgName}</div>
                  <div className="truncate text-xs text-ink-500">{roleLabel}</div>
                </div>
              </div>
            </div>

            {/* Menu items */}
            <div className="p-1.5">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleNavigate(item.to)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-white/[0.06] hover:text-white"
                >
                  <item.icon size={15} className="text-ink-400" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Logout */}
            <div className="border-t border-white/[0.06] p-1.5">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-err-400 transition-colors hover:bg-err-500/10"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
