import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input, Button } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('No active session. Please sign in again.');
      return;
    }
    if (!orgName.trim()) {
      setError('Organization name is required.');
      return;
    }

    setLoading(true);

    const slug = slugify(orgName) || `org-${Date.now()}`;

    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .insert({ name: orgName.trim(), slug, plan: 'starter', owner_id: user.id })
      .select()
      .single();

    if (orgError) {
      setError(orgError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('organization_members')
      .insert({
        organization_id: org.id,
        user_id: user.id,
        role: 'owner',
        status: 'active',
      });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ organization_id: org.id, role: 'owner' })
      .eq('id', user.id);

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    await refreshProfile();
    navigate('/');
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-accent-500 text-ink-950">
          <Building2 size={24} />
        </div>
        <h1 className="text-center text-xl font-semibold text-white">Create your organization</h1>
        <p className="mt-1 text-center text-sm text-ink-400">
          This is where your projects, videos, and team members will live.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Organization name"
          placeholder="e.g. Greater London Transport Authority"
          leftIcon={<Building2 size={15} />}
          value={orgName}
          onChange={(e) => setOrgName(e.target.value)}
          required
          autoFocus
        />

        <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-3 text-xs text-ink-400">
          Your organization starts on the <span className="font-medium text-brand-300">Starter</span> plan
          with 100GB storage and 200 GPU-hours per month. You can upgrade anytime.
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading} rightIcon={loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}>
          {loading ? 'Creating…' : 'Create Organization'}
        </Button>
      </form>
    </AuthLayout>
  );
}
