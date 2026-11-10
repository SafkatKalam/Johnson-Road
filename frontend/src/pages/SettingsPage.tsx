import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Globe, Bell, Shield, Key, Accessibility, Moon } from 'lucide-react';
import { Card, CardHeader, Badge, Toggle } from '@/components/ui';
import { usePreferences, type FontSize } from '@/lib/preferences';

const tabs = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'accessibility', label: 'Accessibility', icon: Accessibility },
  { id: 'language', label: 'Language', icon: Globe },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
  { id: 'api-keys', label: 'API Keys', icon: Key },
];

const fontSizes: { key: FontSize; label: string }[] = [
  { key: 'small', label: 'Small' },
  { key: 'medium', label: 'Medium' },
  { key: 'large', label: 'Large' },
];

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState('appearance');
  const { preferences, update } = usePreferences();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <p className="mt-1 text-sm text-ink-400">Settings on this page are saved in this browser only.</p>
      </div>

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
          {activeTab === 'appearance' && (
            <Card padding="lg">
              <CardHeader title="Appearance" subtitle="How Johnson Road looks" icon={<Palette size={16} />} />
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-200">Theme</p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/[0.06] p-4" aria-current="true">
                      <Moon size={18} className="text-brand-300" />
                      <span className="text-xs font-medium text-white">Dark</span>
                    </div>
                    {['Light', 'System'].map((name) => (
                      <div key={name} aria-disabled="true" className="flex flex-col items-center gap-2 rounded-xl border border-white/[0.05] bg-ink-900/40 p-4 opacity-50">
                        <span className="text-xs font-medium text-ink-300">{name}</span>
                        <span className="text-[10px] text-ink-400">Not available yet</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-ink-400">Johnson Road currently has a dark theme only.</p>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'accessibility' && (
            <Card padding="lg">
              <CardHeader title="Accessibility" subtitle="Adjust the app for better usability" icon={<Accessibility size={16} />} />
              <div className="mt-5 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium text-ink-200">Text size</p>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Text size">
                    {fontSizes.map((size) => (
                      <button
                        key={size.key}
                        onClick={() => update({ fontSize: size.key })}
                        aria-pressed={preferences.fontSize === size.key}
                        className={`rounded-lg border py-2 text-sm transition-all ${
                          preferences.fontSize === size.key
                            ? 'border-brand-500/40 bg-brand-500/[0.06] text-white'
                            : 'border-white/[0.05] bg-ink-900/40 text-ink-300 hover:border-white/10'
                        }`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 px-3 py-2.5">
                  <div>
                    <div className="text-sm text-ink-100">Reduce motion</div>
                    <div className="text-xs text-ink-400">
                      Minimize animations and transitions. When this is off, your device's own "reduce motion" setting is still followed.
                    </div>
                  </div>
                  <Toggle checked={preferences.reduceMotion} onChange={(v) => update({ reduceMotion: v })} />
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'language' && (
            <Unavailable icon={<Globe size={16} />} title="Language & Region">
              The app is in English only for now. Other languages, date formats and time zones are not available yet.
            </Unavailable>
          )}

          {activeTab === 'notifications' && (
            <Unavailable icon={<Bell size={16} />} title="Notifications">
              Notification settings are not available yet. Email delivery is not connected, and in-app notifications arrive with
              the processing features.
            </Unavailable>
          )}

          {activeTab === 'security' && (
            <Unavailable icon={<Shield size={16} />} title="Security">
              Two-factor authentication, login alerts and auto-logout are not available yet. You can change your password on the{' '}
              <Link to="/profile" className="text-brand-300 hover:text-brand-200">My Profile</Link> page.
            </Unavailable>
          )}

          {activeTab === 'api-keys' && (
            <Unavailable icon={<Key size={16} />} title="API Keys">
              API access is not available yet, so there are no keys to create or revoke.
            </Unavailable>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Unavailable({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card padding="lg">
      <CardHeader title={title} subtitle="This part of Settings is not built yet" icon={icon} />
      <div className="mt-5 flex items-start gap-3 rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
        <Badge tone="slate">Not available yet</Badge>
        <p className="text-sm text-ink-300">{children}</p>
      </div>
    </Card>
  );
}
