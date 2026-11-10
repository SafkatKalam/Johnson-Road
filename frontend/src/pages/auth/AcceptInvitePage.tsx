import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MailCheck, AlertCircle, Loader2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { capturePendingInvite, clearPendingInvite } from '@/lib/pendingInvite';
import { OrganizationService, describeOrgError, orgErrorCode } from '@/services/organization.service';

// After these answers the invitation can never work for this person, so it is thrown away at once.
// Without that, the saved token would send a person without an organisation back here again and again.
const DEAD_FOR_GOOD = new Set(['invite_invalid', 'already_member']);

/** Where an invitation link lands. Accepting is an explicit button press, never automatic. */
export function AcceptInvitePage() {
  const navigate = useNavigate();
  const { user, loading, refreshProfile, signOut } = useAuth();
  const [token, setToken] = useState(() => capturePendingInvite());
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [fixable, setFixable] = useState(false); // wrong address / unconfirmed: another sign-in could still work

  // Not signed in: sign in first. The token stays in this tab's storage and the person comes back here.
  useEffect(() => {
    if (!loading && !user && token) navigate('/login', { replace: true, state: { inviteNotice: true } });
  }, [loading, user, token, navigate]);

  const discard = () => {
    clearPendingInvite();
    setToken(null);
    navigate('/', { replace: true });
  };

  const accept = async () => {
    if (!token) return;
    setWorking(true);
    setError('');
    try {
      await OrganizationService.acceptInvite(token);
      clearPendingInvite();
      await refreshProfile();
      navigate('/', { replace: true });
    } catch (err) {
      const code = orgErrorCode(err);
      setError(describeOrgError(err, 'self'));
      if (DEAD_FOR_GOOD.has(code)) {
        // Forget it here too, not only in storage: otherwise the button stays and each click adds a refusal.
        clearPendingInvite();
        setToken(null);
      }
      setFixable(code === 'invite_wrong_account' || code === 'email_not_confirmed');
      setWorking(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout>
        <div className="py-4 text-center">
          <h1 className="text-xl font-semibold text-white">No invitation found</h1>
          <p className="mt-2 text-sm text-ink-400">Open the link you were sent. It may have expired or already been used.</p>
          {error && <p role="alert" className="mt-3 text-sm text-err-400">{error}</p>}
          <Link to="/" className="mt-5 inline-block"><Button size="sm" variant="secondary">Continue to the app</Button></Link>
        </div>
      </AuthLayout>
    );
  }

  if (loading || !user) {
    return <AuthLayout><p className="py-8 text-center text-sm text-ink-400">Checking your sign-in…</p></AuthLayout>;
  }

  return (
    <AuthLayout>
      <div className="py-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
          <MailCheck size={28} />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-white">You've been invited</h1>
        <p className="mt-2 text-sm text-ink-400">
          Signed in as <span className="text-ink-200">{user.email}</span>. Accept to join the organisation that invited you.
        </p>
        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-left text-sm text-err-400">
            <AlertCircle size={15} className="shrink-0" /> {error}
          </div>
        )}
        <Button onClick={accept} size="lg" className="mt-6 w-full" disabled={working}
          leftIcon={working ? <Loader2 size={16} className="animate-spin" /> : undefined}>
          {working ? 'Joining…' : 'Accept invitation'}
        </Button>
        {fixable && (
          <Button variant="secondary" size="sm" className="mt-3 w-full"
            onClick={async () => { await signOut({ keepInvite: true }); navigate('/login', { replace: true }); }}>
            Sign out and use another account
          </Button>
        )}
        {/* An exit that always works: dropping the invitation lets a person with no organisation create their own. */}
        <button type="button" onClick={discard} className="mt-4 inline-block text-xs text-ink-400 hover:text-ink-200">
          Not now: discard this invitation
        </button>
      </div>
    </AuthLayout>
  );
}
