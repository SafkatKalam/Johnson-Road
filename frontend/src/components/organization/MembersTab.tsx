import { useState } from 'react';
import { Users, Trash2, Loader2, X } from 'lucide-react';
import { Card, Button, Badge, EmptyState } from '@/components/ui';
import { roleConfig } from '@/components/organization/roles';
import { formatDate } from '@/lib/utils';
import {
  OrganizationService,
  describeOrgError,
  type OrgInviteItem,
  type OrgMemberItem,
} from '@/services/organization.service';

const stateTone: Record<OrgInviteItem['state'], 'amber' | 'brand' | 'slate' | 'rose'> = {
  open: 'amber',
  accepted: 'brand',
  revoked: 'slate',
  expired: 'rose',
};

interface Props {
  members: OrgMemberItem[];
  invites: OrgInviteItem[] | null; // null when the caller may not see invitations
  invitesTruncated: boolean;       // the server stopped at its limit: older invitations are not shown
  onChanged: () => void;
}

export function MembersTab({ members, invites, invitesTruncated, onChanged }: Props) {
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState('');
  const [error, setError] = useState('');

  const run = async (key: string, action: () => Promise<unknown>) => {
    setBusy(key);
    setError('');
    try {
      await action();
      setConfirming('');
      onChanged();
    } catch (err) {
      setError(describeOrgError(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">{error}</div>
      )}

      <Card padding="none">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Members</h3>
          <p className="mt-1 text-xs text-ink-400">{members.length} member{members.length !== 1 ? 's' : ''} in this organization.</p>
        </div>
        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" description="Invite team members to collaborate on projects." />
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {members.map((m) => {
              const cfg = roleConfig[m.role];
              const RoleIcon = cfg.icon;
              return (
                <div key={m.id} data-testid="member-row" className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-sm font-bold text-ink-950">
                    {(m.name || m.email).slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-100">
                      {m.name || m.email}
                      {m.isYou && <span className="ml-1.5 text-xs text-ink-400">(you)</span>}
                    </p>
                    <p className="mt-0.5 text-xs text-ink-400">{m.email} · Joined {formatDate(m.joinedAt)}</p>
                  </div>

                  {m.canChangeRole ? (
                    <select
                      aria-label={`Role of ${m.email}`}
                      value={m.role}
                      disabled={busy === `role-${m.id}`}
                      onChange={(e) => run(`role-${m.id}`, () => OrganizationService.changeRole(m.id, e.target.value as 'admin' | 'researcher'))}
                      className="h-8 rounded-lg border border-white/[0.08] bg-ink-900/60 px-2 text-xs text-ink-100"
                    >
                      <option value="researcher">Researcher</option>
                      <option value="admin">Administrator</option>
                    </select>
                  ) : (
                    <Badge tone={cfg.tone}><RoleIcon size={11} className="mr-1" /> {cfg.label}</Badge>
                  )}

                  {m.canRemove && (
                    confirming === m.id ? (
                      <span className="flex items-center gap-2">
                        <Button variant="danger" size="sm" disabled={busy === `rm-${m.id}`}
                          onClick={() => run(`rm-${m.id}`, () => OrganizationService.removeMember(m.id))}>
                          {busy === `rm-${m.id}` ? <Loader2 size={13} className="animate-spin" /> : m.isYou ? 'Yes, leave' : 'Yes, remove'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setConfirming('')}>Cancel</Button>
                      </span>
                    ) : (
                      <Button variant="ghost" size="sm" leftIcon={<Trash2 size={13} />} onClick={() => setConfirming(m.id)}>
                        {m.isYou ? 'Leave' : 'Remove'}
                      </Button>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {invites !== null && (
        <Card padding="none">
          <div className="border-b border-white/[0.06] px-5 py-4">
            <h3 className="text-sm font-semibold text-white">Invitations</h3>
            <p className="mt-1 text-xs text-ink-400">Invitation links are not emailed yet: copy the link when you create one.</p>
            {invitesTruncated && (
              <p className="mt-1 text-xs text-amber-300">Showing the 100 most recent invitations. Older ones are not listed.</p>
            )}
          </div>
          {invites.length === 0 ? (
            <p className="px-5 py-6 text-sm text-ink-400">No invitations yet.</p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {invites.map((i) => (
                <div key={i.id} data-testid="invite-row" className="flex flex-wrap items-center gap-4 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-ink-100">{i.email}</p>
                    <p className="text-xs text-ink-400">
                      {roleConfig[i.role].label} · invited by {i.invitedBy} · {i.state === 'open' ? `expires ${formatDate(i.expiresAt)}` : i.state}
                    </p>
                  </div>
                  <Badge tone={stateTone[i.state]}>{i.state}</Badge>
                  {i.canRevoke && (
                    <Button variant="ghost" size="sm" leftIcon={<X size={13} />} disabled={busy === `inv-${i.id}`}
                      onClick={() => run(`inv-${i.id}`, () => OrganizationService.revokeInvite(i.id))}>
                      Revoke
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
