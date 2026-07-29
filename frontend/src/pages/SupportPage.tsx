import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  HelpCircle,
  Mail,
  Bug,
  Rocket,
  ChevronDown,
  Send,
  ExternalLink,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Select, Badge } from '@/components/ui';
import { faqs, releaseNotes } from '@/lib/mockData';

const tabs = [
  { id: 'docs', label: 'Documentation', icon: BookOpen },
  { id: 'faqs', label: 'FAQs', icon: HelpCircle },
  { id: 'contact', label: 'Contact', icon: Mail },
  { id: 'bug', label: 'Report Bug', icon: Bug },
  { id: 'releases', label: 'Release Notes', icon: Rocket },
];

const docs = [
  { id: 'd1', title: 'Getting Started Guide', description: 'Upload your first CCTV video and run AI analysis', url: '#' },
  { id: 'd2', title: 'Detection Models', description: 'Understanding YOLOv8x, ByteTrack, and tracking algorithms', url: '#' },
  { id: 'd3', title: 'Report Export', description: 'Generate PDF, Excel, and CSV reports from your analysis', url: '#' },
  { id: 'd4', title: 'Detection Zones & Count Lines', description: 'How to define polygon regions and counting lines', url: '#' },
  { id: 'd5', title: 'API Reference', description: 'Programmatic access to Johnson Road analytics', url: '#' },
  { id: 'd6', title: 'Data Privacy & Security', description: 'How your video data is stored, encrypted, and deleted', url: '#' },
];

export function SupportPage() {
  const [activeTab, setActiveTab] = useState('docs');
  const [openFaq, setOpenFaq] = useState<string | null>('f1');
  const [bugSubmitted, setBugSubmitted] = useState(false);
  const [contactSent, setContactSent] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Support</h2>
        <p className="mt-1 text-sm text-ink-400">Documentation, FAQs, and ways to reach our team.</p>
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

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {/* Documentation */}
          {activeTab === 'docs' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {docs.map((doc) => (
                <a key={doc.id} href={doc.url} onClick={(e) => e.preventDefault()}>
                  <motion.div
                    className="surface surface-hover p-5"
                    whileHover={{ y: -2 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
                      <BookOpen size={16} />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold text-white">{doc.title}</h3>
                    <p className="mt-1 text-xs text-ink-400">{doc.description}</p>
                    <div className="mt-3 flex items-center gap-1 text-xs text-brand-300">
                      Read more <ExternalLink size={11} />
                    </div>
                  </motion.div>
                </a>
              ))}
            </div>
          )}

          {/* FAQs */}
          {activeTab === 'faqs' && (
            <div className="mx-auto max-w-2xl space-y-3">
              {faqs.map((faq) => (
                <div key={faq.id} className="surface overflow-hidden">
                  <button
                    onClick={() => setOpenFaq(openFaq === faq.id ? null : faq.id)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <span className="text-sm font-medium text-ink-100">{faq.question}</span>
                    <ChevronDown
                      size={16}
                      className={`shrink-0 text-ink-400 transition-transform ${openFaq === faq.id ? 'rotate-180' : ''}`}
                    />
                  </button>
                  <AnimatePresence>
                    {openFaq === faq.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <p className="px-4 pb-4 text-sm leading-relaxed text-ink-400">{faq.answer}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}

          {/* Contact */}
          {activeTab === 'contact' && (
            <Card padding="lg" className="mx-auto max-w-xl">
              {contactSent ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
                    <Send size={26} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">Message sent</h3>
                  <p className="mt-1 text-sm text-ink-400">We'll get back to you within 24 hours.</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => setContactSent(false)}>
                    Send another
                  </Button>
                </div>
              ) : (
                <>
                  <CardHeader title="Contact Support" subtitle="We typically respond within 24 hours" icon={<Mail size={16} />} />
                  <form
                    className="mt-5 space-y-4"
                    onSubmit={(e) => { e.preventDefault(); setContactSent(true); }}
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <Input label="Name" placeholder="Your name" defaultValue="Shadiatun Alam" />
                      <Input label="Email" placeholder="you@example.com" defaultValue="shadiatun.alam@johnsonroad.io" />
                    </div>
                    <Select label="Category">
                      <option>General question</option>
                      <option>Technical issue</option>
                      <option>Billing inquiry</option>
                      <option>Feature request</option>
                    </Select>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-ink-200">Message</label>
                      <textarea
                        rows={4}
                        placeholder="Describe your issue…"
                        className="w-full resize-none rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-400 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>
                    <Button type="submit" leftIcon={<Send size={15} />}>Send Message</Button>
                  </form>
                </>
              )}
            </Card>
          )}

          {/* Report Bug */}
          {activeTab === 'bug' && (
            <Card padding="lg" className="mx-auto max-w-xl">
              {bugSubmitted ? (
                <div className="py-8 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
                    <Bug size={26} />
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">Bug report submitted</h3>
                  <p className="mt-1 text-sm text-ink-400">Ticket #JR-{Math.floor(Math.random() * 9000) + 1000} created. Our team will investigate.</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={() => setBugSubmitted(false)}>
                    Report another
                  </Button>
                </div>
              ) : (
                <>
                  <CardHeader title="Report a Bug" subtitle="Help us improve Johnson Road" icon={<Bug size={16} />} />
                  <form
                    className="mt-5 space-y-4"
                    onSubmit={(e) => { e.preventDefault(); setBugSubmitted(true); }}
                  >
                    <Input label="Bug title" placeholder="Brief description of the issue" />
                    <div className="grid grid-cols-2 gap-4">
                      <Select label="Severity">
                        <option>Low — cosmetic</option>
                        <option>Medium — functionality affected</option>
                        <option>High — blocking workflow</option>
                        <option>Critical — data loss</option>
                      </Select>
                      <Select label="Page affected">
                        <option>Dashboard</option>
                        <option>Projects</option>
                        <option>Upload Center</option>
                        <option>Processing</option>
                        <option>Reports</option>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-ink-200">Steps to reproduce</label>
                      <textarea
                        rows={4}
                        placeholder="1. Go to…&#10;2. Click on…&#10;3. See error…"
                        className="w-full resize-none rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-400 focus:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                      />
                    </div>
                    <Button type="submit" variant="danger" leftIcon={<Bug size={15} />}>Submit Bug Report</Button>
                  </form>
                </>
              )}
            </Card>
          )}

          {/* Release Notes */}
          {activeTab === 'releases' && (
            <div className="mx-auto max-w-2xl space-y-4">
              {releaseNotes.map((release) => (
                <Card key={release.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
                        <Rocket size={16} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{release.version}</h3>
                        <p className="text-xs text-ink-400">{release.date}</p>
                      </div>
                    </div>
                    {release.id === 'r1' && <Badge tone="brand" dot>Latest</Badge>}
                  </div>
                  <ul className="mt-4 space-y-2">
                    {release.changes.map((change, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-ink-300">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                        {change}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
