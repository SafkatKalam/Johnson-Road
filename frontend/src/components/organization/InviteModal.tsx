import { useState } from 'react';
import { Mail, Loader2, Copy, Check } from 'lucide-react';
import { Button, Input, Select, Modal } from '@/components/ui';
import {
  OrganizationService,
  describeOrgError,
  type CreatedInvite,
  type OrgRole,
} from '@/services/organization.service';

interface Props {
  open: boolean;
  onClose: () => void;
  /** The role of the person inviting: an administrator can only invite researchers. */
  myRole: OrgRole;
  onCreated: () => void;
}

export function InviteModal({ open, onClose, myRole, onCreated }: Props) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'researcher'>('researcher');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<CreatedInvite | null>(null);
  const [copied, setCopied] = useState(false);

  const [warnClose, setWarnClose] = useState(false);

  const close = () => {
    setEmail('');
    setRole('researcher');
    setError('');
    setCreated(null);
    setCopied(false);
    setWarnClose(false);
    onClose();
  };

  // The link is shown once. Closing by Esc, a click outside or "Done" before copying asks once first.
  const requestClose = () => {
    if (created && !copied && !warnClose) {
      setWarnClose(true);
      return;
    }
    close();
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (working || created) return; // a second Enter or click while the first is in flight must not send another
    setError('');
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    setWorking(true);
    try {
      setCreated(await OrganizationService.createInvite(email.trim(), role));
      onCreated();
    } catch (err) {
      setError(describeOrgError(err));
    } finally {
      setWorking(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.acceptUrl);
      setCopied(true);
    } catch {
      setError('Could not copy automatically. Select the link and copy it by hand.');
    }
  };

  return (
    <Modal
      open={open}
      onClose={requestClose}
      title="Invite Member"
      description={created ? 'Send this link to the person you invited.' : 'Create an invitation link for a colleague.'}
      size="sm"
      footer={
        created ? (
          <Button onClick={requestClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={submit} disabled={working} leftIcon={working ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}>
              {working ? 'Creating…' : 'Create invitation'}
            </Button>
          </>
        )
      }
    >
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          {error}
        </div>
      )}

      {warnClose && !copied && (
        <div role="alert" className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5 text-sm text-amber-300">
          This link will not be shown again. Copy it first, or press Done once more to close without copying.
        </div>
      )}

      {created ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-3 text-xs text-ink-300">
            No email has been sent: email delivery is not connected yet. Send this link to{' '}
            <span className="text-ink-100">{created.invite.email}</span> yourself. It is shown only once and works for 7 days,
            and only for that email address.
          </div>
          <input
            readOnly
            aria-label="Invitation link"
            value={created.acceptUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-9 w-full rounded-lg border border-white/[0.08] bg-ink-900/60 px-3 text-xs text-ink-50"
          />
          <Button variant="secondary" size="sm" onClick={copy} leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}>
            {copied ? 'Copied' : 'Copy link'}
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email address" type="email" placeholder="colleague@example.com" leftIcon={<Mail size={15} />}
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'researcher')}>
            <option value="researcher">Researcher — view and analyze projects</option>
            {myRole === 'owner' && <option value="admin">Administrator — manage researchers and the organisation</option>}
          </Select>
        </form>
      )}
    </Modal>
  );
}
