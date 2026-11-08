import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { MailCheck, Loader2, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button, Input } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { takeCallbackNotice } from '@/lib/authNotice';
import { AuthService } from '@/services/auth.service';

const RESEND_WAIT_SECONDS = 60;
const COOLDOWN_KEY = 'jr-resend-until';

/** Seconds left of the wait since the last resend. Kept in this tab's storage so a reload does not skip it. */
function remainingCooldown(): number {
  try {
    const until = Number(sessionStorage.getItem(COOLDOWN_KEY));
    return until > Date.now() ? Math.ceil((until - Date.now()) / 1000) : 0;
  } catch {
    return 0;
  }
}

function startCooldown(): void {
  try {
    sessionStorage.setItem(COOLDOWN_KEY, String(Date.now() + RESEND_WAIT_SECONDS * 1000));
  } catch {
    /* storage can be blocked; the wait then only lasts until reload */
  }
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, refreshProfile } = useAuth();
  // The address comes from the sign-up page through router state, never through the URL (no personal data in URLs).
  const stateEmail = (location.state as { email?: string } | null)?.email ?? '';
  // Opened in a new tab or by address: there is no email in the state, so the person can type it.
  const [typedEmail, setTypedEmail] = useState('');
  const email = stateEmail || typedEmail.trim();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(remainingCooldown);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Read in an effect, not in the state initialiser (React runs initialisers twice in development).
  useEffect(() => {
    const notice = takeCallbackNotice();
    if (notice) setError(notice);
  }, []);

  // Already signed in (the link was opened in this browser): the route guards decide where to go next.
  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const handleCheck = async () => {
    setChecking(true);
    setError('');
    setInfo('');
    try {
      const session = await AuthService.getSession();
      if (session) {
        await refreshProfile();
        navigate('/', { replace: true });
        return;
      }
      setInfo(
        "We can't see a confirmed sign-in in this browser yet. Click the link in your email first. " +
          "If you already did, on another device or browser, just sign in with your email and password."
      );
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');
    setInfo('');
    try {
      await AuthService.resendConfirmation(email);
      setInfo('We asked for a new link. It can take a few minutes to arrive.');
      startCooldown();
      setCooldown(RESEND_WAIT_SECONDS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a new link. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout>
      <div className="py-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
          <MailCheck size={28} />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">Verify your email</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-400">
          {email ? (
            <>We've sent a verification link to <span className="text-ink-200">{email}</span>.</>
          ) : (
            <>We've sent a verification link to your email address.</>
          )}{' '}
          Click the link in the email to continue setting up your account.
        </p>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-left text-sm text-err-400">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}
        {info && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/[0.06] bg-ink-900/40 px-3 py-2.5 text-left text-sm text-ink-200">
            <CheckCircle2 size={15} className="shrink-0 text-brand-400" /> {info}
          </div>
        )}

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

        <Button
          onClick={handleResend}
          variant="secondary"
          size="lg"
          className="mt-3 w-full"
          disabled={resending || cooldown > 0 || !email}
        >
          {resending ? 'Sending…' : cooldown > 0 ? `Send again in ${cooldown}s` : 'Resend the email'}
        </Button>
        {!stateEmail && (
          <div className="mt-4 text-left">
            <Input
              label="Your email address"
              type="email"
              placeholder="you@example.com"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              autoComplete="email"
            />
            <p className="mt-1 text-xs text-ink-400">Type the address you signed up with to get a new link.</p>
          </div>
        )}

        <Link to="/login" className="mt-4 inline-flex items-center gap-1 text-xs text-ink-400 hover:text-ink-200">
          <ArrowRight size={12} /> Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
