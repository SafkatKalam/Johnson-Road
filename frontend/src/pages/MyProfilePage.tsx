import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User,
  Lock,
  Shield,
  Monitor,
  Bell,
  Save,
  Check,
  Smartphone,
  Globe,
  Clock,
  Trash2,
  LogOut,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Badge, Toggle } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const tabs = [
  { id: 'personal', label: 'Personal Information', icon: User },
  { id: 'password', label: 'Password', icon: Lock },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'sessions', label: 'Sessions', icon: Monitor },
  { id: 'notifications', label: 'Notification Preferences', icon: Bell },
];

const mockSessions = [
  { id: '1', device: 'MacBook Pro', browser: 'Chrome 126', location: 'London, UK', ip: '82.14.220.31', lastActive: 'Active now', current: true },
  { id: '2', device: 'iPhone 15', browser: 'Safari Mobile', location: 'London, UK', ip: '82.14.220.31', lastActive: '2h ago', current: false },
  { id: '3', device: 'Windows PC', browser: 'Firefox 127', location: 'Manchester, UK', ip: '92.40.180.55', lastActive: '1d ago', current: false },
];

export function MyProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('personal');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  const [twoFactor, setTwoFactor] = useState(false);
  const [loginAlerts, setLoginAlerts] = useState(true);

  const [notifPrefs, setNotifPrefs] = useState({
    emailProcessing: true,
    emailReports: true,
    emailBilling: true,
    emailSecurity: true,
    pushProcessing: false,
    pushReports: true,
  });

  const handleSaveProfile = async () => {
    setSaving(true);
    await supabase.from('profiles').update({ full_name: fullName, avatar_url: avatarUrl || null }).eq('id', user?.id);
    await refreshProfile();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('Password must be at least 8 characters.');
      return;
    }

    setPwLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwLoading(false);

    if (error) {
      setPwError(error.message);
    } else {
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">My Profile</h2>
        <p className="mt-1 text-sm text-ink-400">Manage your account, security, and preferences.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="mx-auto max-w-2xl space-y-6"
        >
          {/* PERSONAL INFORMATION */}
          {activeTab === 'personal' && (
            <Card padding="lg">
              <CardHeader title="Personal Information" subtitle="Update your name and profile photo" icon={<User size={16} />} />
              <div className="mt-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-xl font-bold text-ink-950">
                    {(fullName || user?.email || '?').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm text-ink-200">Profile photo</p>
                    <p className="text-xs text-ink-400">JPG, PNG, or GIF. Max 2MB.</p>
                  </div>
                </div>
                <Input label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                <Input label="Email" value={user?.email || ''} disabled hint="Contact support to change your email address." />
                <Input label="Avatar URL" placeholder="https://…" value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} hint="Paste an image URL for your avatar." />
                <Button leftIcon={saved ? <Check size={15} /> : <Save size={15} />} onClick={handleSaveProfile} disabled={saving}>
                  {saved ? 'Saved' : saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {/* PASSWORD */}
          {activeTab === 'password' && (
            <Card padding="lg">
              <CardHeader title="Change Password" subtitle="Choose a strong password you haven't used before" icon={<Lock size={16} />} />
              {pwSuccess ? (
                <div className="mt-5 rounded-lg border border-brand-500/20 bg-brand-500/[0.06] p-4 text-sm text-brand-300">
                  <Check size={16} className="mb-1 inline" /> Password updated successfully.
                </div>
              ) : (
                <form onSubmit={handleChangePassword} className="mt-5 space-y-4">
                  {pwError && (
                    <div className="rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
                      {pwError}
                    </div>
                  )}
                  <Input label="Current password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" />
                  <Input label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" hint="At least 8 characters with a mix of letters, numbers, and symbols." />
                  <Input label="Confirm new password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
                  <Button type="submit" disabled={pwLoading}>
                    {pwLoading ? 'Updating…' : 'Update Password'}
                  </Button>
                </form>
              )}
            </Card>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <Card padding="lg">
                <CardHeader title="Two-Factor Authentication" subtitle="Add an extra layer of security to your account" icon={<Shield size={16} />} />
                <div className="mt-5 flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                  <div>
                    <p className="text-sm text-ink-100">Authenticator app</p>
                    <p className="text-xs text-ink-400">Use Google Authenticator, Authy, or similar.</p>
                  </div>
                  <Toggle checked={twoFactor} onChange={() => setTwoFactor(!twoFactor)} />
                </div>
              </Card>
              <Card padding="lg">
                <CardHeader title="Login Alerts" subtitle="Get notified when someone signs into your account" icon={<Bell size={16} />} />
                <div className="mt-5 flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                  <div>
                    <p className="text-sm text-ink-100">Email on new login</p>
                    <p className="text-xs text-ink-400">Send an email when a new device signs in.</p>
                  </div>
                  <Toggle checked={loginAlerts} onChange={() => setLoginAlerts(!loginAlerts)} />
                </div>
              </Card>
            </div>
          )}

          {/* SESSIONS */}
          {activeTab === 'sessions' && (
            <Card padding="none">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <h3 className="text-sm font-semibold text-white">Active Sessions</h3>
                <p className="mt-1 text-xs text-ink-400">Devices currently signed into your account.</p>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {mockSessions.map((s) => (
                  <div key={s.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-white/[0.06]">
                      {s.device.includes('iPhone') ? <Smartphone size={18} /> : <Monitor size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-ink-100">{s.device}</p>
                        {s.current && <Badge tone="brand" dot>Current</Badge>}
                      </div>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-ink-400">
                        <span className="flex items-center gap-1"><Globe size={11} /> {s.location}</span>
                        <span>{s.browser}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {s.lastActive}</span>
                      </p>
                    </div>
                    {!s.current && (
                      <Button variant="ghost" size="sm" leftIcon={<LogOut size={13} />}>
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-white/[0.06] p-4">
                <Button variant="danger" size="sm" leftIcon={<Trash2 size={14} />}>
                  Revoke all other sessions
                </Button>
              </div>
            </Card>
          )}

          {/* NOTIFICATION PREFERENCES */}
          {activeTab === 'notifications' && (
            <Card padding="lg">
              <CardHeader title="Notification Preferences" subtitle="Choose how and when you want to be notified" icon={<Bell size={16} />} />
              <div className="mt-5 space-y-5">
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Email Notifications</p>
                  <div className="space-y-2">
                    <PrefRow label="Processing updates" desc="When a job starts, progresses, or completes" checked={notifPrefs.emailProcessing} onChange={(v) => setNotifPrefs({ ...notifPrefs, emailProcessing: v })} />
                    <PrefRow label="Report ready" desc="When a new report is generated" checked={notifPrefs.emailReports} onChange={(v) => setNotifPrefs({ ...notifPrefs, emailReports: v })} />
                    <PrefRow label="Billing alerts" desc="Invoice generated, payment failed, quota warnings" checked={notifPrefs.emailBilling} onChange={(v) => setNotifPrefs({ ...notifPrefs, emailBilling: v })} />
                    <PrefRow label="Security alerts" desc="New device login, password changes" checked={notifPrefs.emailSecurity} onChange={(v) => setNotifPrefs({ ...notifPrefs, emailSecurity: v })} />
                  </div>
                </div>
                <div>
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Push Notifications</p>
                  <div className="space-y-2">
                    <PrefRow label="Processing updates" desc="Real-time job status changes" checked={notifPrefs.pushProcessing} onChange={(v) => setNotifPrefs({ ...notifPrefs, pushProcessing: v })} />
                    <PrefRow label="Report ready" desc="Instant notification when reports are done" checked={notifPrefs.pushReports} onChange={(v) => setNotifPrefs({ ...notifPrefs, pushReports: v })} />
                  </div>
                </div>
                <Button leftIcon={<Save size={15} />}>Save Preferences</Button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PrefRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 px-3 py-2.5">
      <div>
        <div className="text-sm text-ink-100">{label}</div>
        <div className="text-xs text-ink-400">{desc}</div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}
