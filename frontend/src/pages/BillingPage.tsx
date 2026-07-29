import { motion } from 'framer-motion';
import {
  CreditCard,
  HardDrive,
  FolderKanban,
  Cpu,
  Download,
  ArrowUpRight,
  Check,
  Zap,
  Calendar,
  Wallet,
} from 'lucide-react';
import { Card, CardHeader, Button, Badge, ProgressBar } from '@/components/ui';
import { subscriptionData, invoices } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';

const invoiceStatusTone: Record<string, 'brand' | 'amber' | 'rose'> = {
  paid: 'brand',
  pending: 'amber',
  failed: 'rose',
};

const plans = [
  { name: 'Starter', price: 199, features: ['100GB storage', '200 GPU-hours/mo', '5 projects', 'Email support', 'PDF & CSV export'], current: false },
  { name: 'Pro', price: 999, features: ['500GB storage', '800 GPU-hours/mo', '20 projects', 'Priority support', 'All export formats', 'Custom models'], current: false },
  { name: 'Enterprise', price: 2499, features: ['1TB storage', '2,000 GPU-hours/mo', '50 projects', 'Dedicated support', 'API access', 'Custom integrations', 'SLA guarantee'], current: true },
];

export function BillingPage() {
  const storagePct = (subscriptionData.storageUsed / subscriptionData.storageTotal) * 100;
  const projectsPct = (subscriptionData.projectsUsed / subscriptionData.projectsTotal) * 100;
  const hoursPct = (subscriptionData.processingHoursUsed / subscriptionData.processingHoursTotal) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Billing & Subscription</h2>
          <p className="mt-1 text-sm text-ink-400">Manage your plan, usage, payment method, and invoices.</p>
        </div>
        <Button leftIcon={<Zap size={15} />}>Upgrade Plan</Button>
      </div>

      {/* Current Plan */}
      <Card padding="lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent-500/10 text-brand-300 ring-1 ring-brand-500/20">
              <CreditCard size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold text-white">{subscriptionData.plan}</h3>
                <Badge tone="brand" dot>Active</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-400">
                {formatCurrency(subscriptionData.price)}/{subscriptionData.cycle} · Renews on {formatDate(subscriptionData.renewalDate)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 rounded-xl border border-white/[0.06] bg-ink-900/40 p-4">
            <UsageMetric icon={HardDrive} label="Storage" used={subscriptionData.storageUsed} total={subscriptionData.storageTotal} unit="GB" pct={storagePct} />
            <UsageMetric icon={FolderKanban} label="Projects" used={subscriptionData.projectsUsed} total={subscriptionData.projectsTotal} unit="" pct={projectsPct} />
            <UsageMetric icon={Cpu} label="GPU Hours" used={subscriptionData.processingHoursUsed} total={subscriptionData.processingHoursTotal} unit="h" pct={hoursPct} />
          </div>
        </div>
      </Card>

      {/* Usage bars */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card padding="md">
          <CardHeader title="Storage Usage" icon={<HardDrive size={16} />} action={<span className="text-xs text-ink-400">{storagePct.toFixed(0)}%</span>} />
          <div className="mt-4">
            <ProgressBar value={storagePct} tone={storagePct > 80 ? 'rose' : 'brand'} />
            <p className="mt-2 text-xs text-ink-400">{subscriptionData.storageUsed} GB of {subscriptionData.storageTotal} GB used</p>
          </div>
        </Card>
        <Card padding="md">
          <CardHeader title="Processing Hours" icon={<Cpu size={16} />} action={<span className="text-xs text-ink-400">{hoursPct.toFixed(0)}%</span>} />
          <div className="mt-4">
            <ProgressBar value={hoursPct} tone="amber" />
            <p className="mt-2 text-xs text-ink-400">{subscriptionData.processingHoursUsed}h of {subscriptionData.processingHoursTotal}h used</p>
          </div>
        </Card>
        <Card padding="md">
          <CardHeader title="Projects" icon={<FolderKanban size={16} />} action={<span className="text-xs text-ink-400">{projectsPct.toFixed(0)}%</span>} />
          <div className="mt-4">
            <ProgressBar value={projectsPct} tone="sky" />
            <p className="mt-2 text-xs text-ink-400">{subscriptionData.projectsUsed} of {subscriptionData.projectsTotal} projects</p>
          </div>
        </Card>
      </div>

      {/* Payment Method */}
      <Card padding="md">
        <CardHeader title="Payment Method" subtitle="Your default payment card" icon={<Wallet size={16} />} />
        <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.06] bg-ink-900/40 p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-ink-700 to-ink-800 text-xs font-bold text-white ring-1 ring-white/[0.06]">
              VISA
            </div>
            <div>
              <p className="text-sm font-medium text-ink-100">•••• •••• •••• 4242</p>
              <p className="text-xs text-ink-400">Expires 08/2028 · Aisha Khan</p>
            </div>
          </div>
          <Button variant="secondary" size="sm">Update</Button>
        </div>
      </Card>

      {/* Plans comparison */}
      <Card padding="md">
        <CardHeader title="Upgrade Plan" subtitle="Compare and choose the right plan for your team" icon={<ArrowUpRight size={16} />} />
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <motion.div
              key={plan.name}
              className={`rounded-xl border p-5 transition-all ${plan.current ? 'border-brand-500/30 bg-brand-500/[0.04]' : 'border-white/[0.06] bg-ink-900/40'}`}
              whileHover={{ y: -2 }}
            >
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-white">{plan.name}</h4>
                {plan.current && <Badge tone="brand" dot>Current</Badge>}
              </div>
              <div className="mt-2 text-2xl font-bold text-white">{formatCurrency(plan.price)}<span className="text-sm font-normal text-ink-400">/mo</span></div>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-ink-300">
                    <Check size={13} className="text-brand-400" /> {f}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.current ? 'secondary' : 'primary'}
                size="sm"
                className="mt-5 w-full"
                disabled={plan.current}
              >
                {plan.current ? 'Current Plan' : 'Upgrade'}
              </Button>
            </motion.div>
          ))}
        </div>
      </Card>

      {/* Billing History */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Billing History</h3>
            <p className="mt-1 text-xs text-ink-400">Download past invoices and payment receipts.</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-left text-xs text-ink-400">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Description</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {invoices.map((inv) => (
                <tr key={inv.id} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-5 py-3 font-mono text-xs text-ink-300">{inv.id}</td>
                  <td className="px-5 py-3 text-ink-300">{formatDate(inv.date)}</td>
                  <td className="px-5 py-3 text-ink-200">{inv.description}</td>
                  <td className="px-5 py-3 font-medium text-white">{formatCurrency(inv.amount)}</td>
                  <td className="px-5 py-3"><Badge tone={invoiceStatusTone[inv.status]}>{inv.status}</Badge></td>
                  <td className="px-5 py-3 text-right">
                    <button className="flex items-center gap-1 text-xs text-ink-400 transition-colors hover:text-brand-300">
                      <Download size={13} /> PDF
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function UsageMetric({ icon: Icon, label, used, total, unit, pct }: { icon: typeof HardDrive; label: string; used: number; total: number; unit: string; pct: number }) {
  return (
    <div className="text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-white/[0.06]">
        <Icon size={15} />
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{used}{unit && ` ${unit}`}</div>
      <div className="text-[10px] text-ink-400">of {total}{unit && ` ${unit}`}</div>
      <div className="mt-1.5">
        <ProgressBar value={pct} size="sm" tone={pct > 80 ? 'rose' : 'brand'} />
      </div>
    </div>
  );
}
