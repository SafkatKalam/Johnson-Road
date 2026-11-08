import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input, Button } from '@/components/ui';
import { isRecoverySession } from '@/lib/supabase';
import { takeCallbackNotice } from '@/lib/authNotice';
import { AuthService } from '@/services/auth.service';

type Stage = 'checking' | 'ready' | 'invalid' | 'done';

/** Where the link in a password-reset email lands. Only a recovery session may set a new password here. */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>('checking');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Read in an effect, not in the state initialiser (React runs initialisers twice in development).
  useEffect(() => {
    const notice = takeCallbackNotice();
    if (notice) setError(notice);
  }, []);

  useEffect(() => {
    let alive = true;
    const subscription = AuthService.onAuthChange((event) => {
      if (event === 'PASSWORD_RECOVERY' && alive) setStage((s) => (s === 'checking' || s === 'invalid' ? 'ready' : s));
    });
    // The recovery event can arrive a moment after the page opens; if it never does, the link is not usable.
    const timer = window.setTimeout(async () => {
      const session = await AuthService.getSession();
      if (alive) setStage((s) => (s === 'checking' ? (session && isRecoverySession() ? 'ready' : 'invalid') : s));
    }, 1500);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await AuthService.updatePassword(password);
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout>
      {stage === 'checking' && <p className="py-8 text-center text-sm text-ink-400">Checking your link…</p>}

      {stage === 'invalid' && (
        <div className="py-4 text-center">
          <h1 className="text-xl font-semibold text-white">This link cannot be used</h1>
          <p className="mt-2 text-sm text-ink-400">
            {error || 'It has expired, was already used, or was opened in a different browser.'} Request a new one and open it in this browser.
          </p>
          <Link to="/forgot-password" className="mt-5 inline-block">
            <Button size="sm">Request a new link</Button>
          </Link>
        </div>
      )}

      {stage === 'ready' && (
        <>
          <div className="mb-6">
            <h1 className="text-xl font-semibold text-white">Choose a new password</h1>
            <p className="mt-1 text-sm text-ink-400">Other devices signed in to your account will be signed out.</p>
          </div>
          {error && (
            <div role="alert" className="mb-4 flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
              <AlertCircle size={15} /> {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="New password" type="password" placeholder="At least 8 characters" leftIcon={<Lock size={15} />}
              value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
            <Input label="Confirm new password" type="password" placeholder="Re-enter your password" leftIcon={<Lock size={15} />}
              value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
            <Button type="submit" size="lg" className="w-full" disabled={saving} rightIcon={<ArrowRight size={16} />}>
              {saving ? 'Saving…' : 'Set New Password'}
            </Button>
          </form>
        </>
      )}

      {stage === 'done' && (
        <div className="py-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="mt-5 text-xl font-semibold text-white">Password updated</h1>
          <p className="mt-2 text-sm text-ink-400">Your other devices have been signed out.</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => navigate('/', { replace: true })}>Continue</Button>
        </div>
      )}
    </AuthLayout>
  );
}
