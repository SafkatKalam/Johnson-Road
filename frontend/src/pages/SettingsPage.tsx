import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Globe,
  Bell,
  Shield,
  Key,
  Accessibility,
  Sun,
  Moon,
  Monitor,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Select, Badge, Toggle } from '@/components/ui';

const tabs = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api-keys', label: 'API Keys', icon: Key },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
];

const mockApiKeys = [
  { id: '1', name: 'Production API Key', prefix: 'jr_live_8f2a', permissions: ['read', 'write'], created: '2026-07-15', lastUsed: '2h ago' },
  { id: '2', name: 'Analytics Read-Only', prefix: 'jr_live_4d7e', permissions: ['read'], created: '2026-06-20', lastUsed: '5d ago' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('appearance');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [language, setLanguage] = useState('en');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [fontSize, setFontSize] = useState('medium');
  const [showApiKey, setShowApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyPerms, setNewKeyPerms] = useState('read');
  const [apiKeys, setApiKeys] = useState(mockApiKeys);

  const handleCopyKey = (prefix: string) => {
    navigator.clipboard?.writeText(prefix);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;
    const prefix = `jr_live_${Math.random().toString(36).slice(2, 6)}`;
    setApiKeys([...apiKeys, { id: String(Date.now()), name: newKeyName, prefix, permissions: [newKeyPerms], created: '2026-07-29', lastUsed: 'Never' }]);
    setShowCreateKey(false);
    setNewKeyName('');
  };

  const handleDeleteKey = (id: string) => {
    setApiKeys(apiKeys.filter((k) => k.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="mt-1 text-sm text-ink-400">Manage your appearance, security, and API keys.</p>
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
          {/* APPEARANCE */}
          {activeTab === 'appearance' && (
            <Card padding="lg">
              <CardHeader title="Appearance" subtitle="Customize how Johnson Road looks" icon={<Palette size={16} />} />
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-200">Theme</p>
                  <div className="grid grid-cols-3 gap-3">
                    {([
                      { key: 'dark', label: 'Dark', icon: Moon },
                      { key: 'light', label: 'Light', icon: Sun },
                      { key: 'system', label: 'System', icon: Monitor },
                    ] as const).map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setTheme(opt.key)}
                        className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition-all ${
                          theme === opt.key ? 'border-brand-500/40 bg-brand-500/[0.06]' : 'border-white/[0.05] bg-ink-900/40 hover:border-white/10'
                        }`}
                      >
                        <opt.icon size={18} className={theme === opt.key ? 'text-brand-300' : 'text-ink-400'} />
                        <span className={`text-xs font-medium ${theme === opt.key ? 'text-white' : 'text-ink-300'}`}>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                  <div>
                    <p className="text-sm text-ink-100">Compact mode</p>
                    <p className="text-xs text-ink-400">Reduce padding for denser information display.</p>
                  </div>
                  <Toggle checked={false} onChange={() => {}} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                  <div>
                    <p className="text-sm text-ink-100">Show sidebar badges</p>
                    <p className="text-xs text-ink-400">Display count badges on navigation items.</p>
                  </div>
                  <Toggle checked={true} onChange={() => {}} />
                </div>
              </div>
            </Card>
          )}

          {/* LANGUAGE */}
          {activeTab === 'language' && (
            <Card padding="lg">
              <CardHeader title="Language & Region" subtitle="Set your preferred language and date format" icon={<Globe size={16} />} />
              <div className="mt-5 space-y-4">
                <Select label="Display language" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="en">English (US)</option>
                  <option value="en-GB">English (UK)</option>
                  <option value="ar">Arabic</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                </Select>
                <Select label="Date format">
                  <option>YYYY-MM-DD (2026-07-29)</option>
                  <option>DD/MM/YYYY (29/07/2026)</option>
                  <option>MM/DD/YYYY (07/29/2026)</option>
                </Select>
                <Select label="Time format">
                  <option>24-hour (14:30)</option>
                  <option>12-hour (2:30 PM)</option>
                </Select>
                <Select label="Timezone">
                  <option>Europe/London (GMT+1)</option>
                  <option>America/New_York (GMT-4)</option>
                  <option>Asia/Dubai (GMT+4)</option>
                  <option>Asia/Kolkata (GMT+5:30)</option>
                  <option>Australia/Sydney (GMT+10)</option>
                </Select>
                <Button>Save Language Settings</Button>
              </div>
            </Card>
          )}

          {/* NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <Card padding="lg">
              <CardHeader title="Notifications" subtitle="Control in-app and desktop notifications" icon={<Bell size={16} />} />
              <div className="mt-5 space-y-3">
                <SettingToggle label="In-app notifications" desc="Show notifications within the app" checked={true} onChange={() => {}} />
                <SettingToggle label="Desktop notifications" desc="Send OS-level notifications when browser is open" checked={false} onChange={() => {}} />
                <SettingToggle label="Sound effects" desc="Play a sound when notifications arrive" checked={false} onChange={() => {}} />
                <SettingToggle label="Notification digest" desc="Send a daily summary instead of individual alerts" checked={true} onChange={() => {}} />
                <SettingToggle label="Quiet hours" desc="Mute notifications between 10 PM and 8 AM" checked={false} onChange={() => {}} />
              </div>
            </Card>
          )}

          {/* SECURITY */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <Card padding="lg">
                <CardHeader title="Security" subtitle="Protect your account" icon={<Shield size={16} />} />
                <div className="mt-5 space-y-3">
                  <SettingToggle label="Two-factor authentication" desc="Require a code from your authenticator app" checked={false} onChange={() => {}} />
                  <SettingToggle label="Login alerts" desc="Email me when a new device signs in" checked={true} onChange={() => {}} />
                  <SettingToggle label="Auto-logout" desc="Sign out after 30 minutes of inactivity" checked={false} onChange={() => {}} />
                </div>
              </Card>
              <Card padding="lg">
                <CardHeader title="Change Password" subtitle="Update your password" icon={<Shield size={16} />} />
                <div className="mt-5 space-y-4">
                  <Input label="Current password" type="password" placeholder="Enter current password" />
                  <Input label="New password" type="password" placeholder="Enter new password" />
                  <Button>Update Password</Button>
                </div>
              </Card>
            </div>
          )}

          {/* API KEYS */}
          {activeTab === 'api-keys' && (
            <Card padding="none">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">API Keys</h3>
                  <p className="mt-1 text-xs text-ink-400">Manage keys for programmatic API access.</p>
                </div>
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setShowCreateKey(true)}>
                  Create Key
                </Button>
              </div>
              <div className="divide-y divide-white/[0.04]">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center gap-4 px-5 py-4">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-white/[0.06]">
                      <Key size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-100">{key.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="rounded bg-ink-950/60 px-1.5 py-0.5 font-mono text-xs text-ink-300">
                          {showApiKey === key.id ? `${key.prefix}xxxxxxxxxxxx` : `${key.prefix}••••••••••••`}
                        </code>
                        <button onClick={() => setShowApiKey(showApiKey === key.id ? null : key.id)} className="text-ink-400 hover:text-white">
                          {showApiKey === key.id ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <button onClick={() => handleCopyKey(key.prefix)} className="text-ink-400 hover:text-white">
                          {copiedKey ? <Check size={13} className="text-brand-400" /> : <Copy size={13} />}
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-ink-400">Created {key.created} · Last used {key.lastUsed}</p>
                    </div>
                    <div className="flex gap-1">
                      {key.permissions.map((p) => (
                        <Badge key={p} tone={p === 'write' ? 'amber' : 'sky'}>{p}</Badge>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} onClick={() => handleDeleteKey(key.id)}>
                      Revoke
                    </Button>
                  </div>
                ))}
                {apiKeys.length === 0 && (
                  <div className="py-10 text-center text-sm text-ink-400">No API keys created yet.</div>
                )}
              </div>
              {showCreateKey && (
                <div className="border-t border-white/[0.06] p-5">
                  <h4 className="text-sm font-semibold text-white">Create New API Key</h4>
                  <div className="mt-3 space-y-3">
                    <Input label="Key name" placeholder="e.g. Production API Key" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} />
                    <Select label="Permissions" value={newKeyPerms} onChange={(e) => setNewKeyPerms(e.target.value)}>
                      <option value="read">Read-only</option>
                      <option value="write">Read & Write</option>
                    </Select>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => setShowCreateKey(false)}>Cancel</Button>
                      <Button onClick={handleCreateKey} disabled={!newKeyName.trim()}>Create Key</Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* ACCESSIBILITY */}
          {activeTab === 'accessibility' && (
            <Card padding="lg">
              <CardHeader title="Accessibility" subtitle="Adjust the app for better usability" icon={<Accessibility size={16} />} />
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-200">Font size</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['small', 'medium', 'large'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setFontSize(size)}
                        className={`rounded-lg border py-2 text-sm capitalize transition-all ${
                          fontSize === size ? 'border-brand-500/40 bg-brand-500/[0.06] text-white' : 'border-white/[0.05] bg-ink-900/40 text-ink-300 hover:border-white/10'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                <SettingToggle label="Reduce motion" desc="Minimize animations and transitions" checked={reduceMotion} onChange={setReduceMotion} />
                <SettingToggle label="High contrast" desc="Increase contrast for better readability" checked={highContrast} onChange={setHighContrast} />
                <SettingToggle label="Screen reader hints" desc="Add extra ARIA labels for assistive technology" checked={false} onChange={() => {}} />
                <SettingToggle label="Keyboard shortcuts overlay" desc="Show available shortcuts on screen" checked={true} onChange={() => {}} />
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function SettingToggle({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
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
