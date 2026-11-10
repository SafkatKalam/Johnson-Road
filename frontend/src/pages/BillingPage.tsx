import { CreditCard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, Badge } from '@/components/ui';
import { useAuth } from '@/lib/auth';

/**
 * Billing is not built, and no plan limits or prices have been decided (open item O39). This page used to show
 * invented invoices and an "Upgrade Plan" button; it now says plainly that nothing here exists yet.
 */
export function BillingPage() {
  const { organization } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Billing & Subscription</h2>
        <p className="mt-1 text-sm text-ink-400">Plans, payment methods and invoices.</p>
      </div>

      <Card padding="lg" className="mx-auto max-w-2xl">
        <CardHeader title="Not available yet" subtitle="Billing has not been set up" icon={<CreditCard size={16} />} />
        <div className="mt-5 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
            <Badge tone="slate">Not available yet</Badge>
            <p className="text-sm text-ink-300">
              There are no prices, invoices or payment methods yet, and nothing can be bought or upgraded from this app.
              {organization ? (
                <> Your organization <span className="text-ink-100">{organization.name}</span> is on the{' '}
                  <span className="text-ink-100">{organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1)}</span> plan name with no limits set.</>
              ) : null}
            </p>
          </div>
          <p className="text-xs text-ink-400">
            What your organization is actually using is on the <Link to="/organization" className="text-brand-300 hover:text-brand-200">Organization</Link> page.
          </p>
        </div>
      </Card>
    </div>
  );
}
