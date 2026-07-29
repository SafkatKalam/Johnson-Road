import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate('/onboarding');
    }
  }, [user, loading, navigate]);

  const handleCheck = async () => {
    setChecking(true);
    window.location.reload();
  };

  return (
    <AuthLayout>
      <div className="py-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
          <MailCheck size={28} />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">Verify your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          We've sent a verification link to your email address.
          Click the link in the email to continue setting up your account.
        </p>

        <div className="mt-6 rounded-lg border border-white/[0.06] bg-ink-900/40 p-4 text-left text-xs text-ink-400">
          <p className="font-medium text-ink-200">Didn't receive an email?</p>
          <ul className="mt-2 space-y-1">
            <li>Check your spam or junk folder</li>
            <li>Make sure you entered the correct email address</li>
            <li>Wait a few minutes for the email to arrive</li>
          </ul>
        </div>

        <Button onClick={handleCheck} size="lg" className="mt-6 w-full" disabled={checking} leftIcon={checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}>
          {checking ? 'Checking…' : 'I\'ve verified — Continue'}
        </Button>

        <Link to="/login" className="mt-4 inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-200">
          <ArrowRight size={12} /> Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
