import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HelpCircle, Mail, ChevronDown } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui';
import { useAuth } from '@/lib/auth';

const tabs = [
  { id: 'help', label: 'Troubleshooting', icon: HelpCircle },
  { id: 'contact', label: 'Contact', icon: Mail },
];

// Written from what the product really does today. Update this list when a feature changes.
const topics = [
  {
    id: 'signin',
    question: "I can't sign in",
    answer:
      'Check the email address and password. If you just created the account, open the confirmation link in your email first. ' +
      'If you forgot your password, use "Forgot password?" on the sign-in page. Sign-in links and reset links work only once.',
  },
  {
    id: 'email',
    question: "I didn't receive an email",
    answer:
      'Check your spam or junk folder and wait a few minutes. If it still does not arrive, ask your administrator: email delivery ' +
      'for this installation may not be set up yet.',
  },
  {
    id: 'invite',
    question: 'My invitation link does not work',
    answer:
      'An invitation link works once, for 7 days, and only for the email address it was created for. Sign in with that address ' +
      'before accepting it. If it has expired or was already used, ask an owner or administrator for a new one.',
  },
  {
    id: 'error',
    question: 'I see "Something went wrong" with a diagnostic id',
    answer:
      'Copy the diagnostic id from the message and include it when you contact support. It lets them find exactly what failed.',
  },
  {
    id: 'status',
    question: 'What works today?',
    answer:
      'Accounts, sign-in, password reset, your profile, your organization, members and invitations are working. ' +
      'The Projects, Upload, Processing, Reports and Dashboard pages still show sample data while video analysis is being built.',
  },
];

export function SupportPage() {
  const { user, organization, profile } = useAuth();
  const [activeTab, setActiveTab] = useState('help');
  const [openTopic, setOpenTopic] = useState<string | null>(topics[0].id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Support</h2>
        <p className="mt-1 text-sm text-ink-400">Help with the things that work today, and how to reach us.</p>
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
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>
          {activeTab === 'help' && (
            <div className="mx-auto max-w-2xl space-y-3">
              {topics.map((topic) => (
                <div key={topic.id} className="surface overflow-hidden">
                  <button
                    onClick={() => setOpenTopic(openTopic === topic.id ? null : topic.id)}
                    aria-expanded={openTopic === topic.id}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <span className="text-sm font-medium text-ink-100">{topic.question}</span>
                    <ChevronDown size={16} className={`shrink-0 text-ink-400 transition-transform ${openTopic === topic.id ? 'rotate-180' : ''}`} />
                  </button>
                  {openTopic === topic.id && <p className="px-4 pb-4 text-sm leading-relaxed text-ink-400">{topic.answer}</p>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'contact' && (
            <Card padding="lg" className="mx-auto max-w-xl">
              <CardHeader title="Contact support" subtitle="A support contact has not been set up yet" icon={<Mail size={16} />} />
              <p className="mt-4 text-sm text-ink-300">
                There is no support inbox or ticket system connected yet, so nothing can be sent from this page. For now, ask the
                person who manages your Johnson Road account, and give them these details:
              </p>
              <dl className="mt-4 space-y-2 rounded-lg border border-white/[0.06] bg-ink-900/40 p-4 text-sm">
                <div className="flex justify-between gap-4"><dt className="text-ink-400">Your email</dt><dd className="text-ink-100">{user?.email ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-400">Organization</dt><dd className="text-ink-100">{organization?.name ?? '—'}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-ink-400">Your role</dt><dd className="text-ink-100">{profile?.role || '—'}</dd></div>
              </dl>
              <p className="mt-4 text-xs text-ink-400">
                Also say what you were doing, the time it happened, and the diagnostic id if a message showed one.
              </p>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
