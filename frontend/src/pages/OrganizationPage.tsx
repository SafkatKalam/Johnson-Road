import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, Users, Shield, UserPlus, Check, Loader2, AlertCircle } from 'lucide-react';
import { Card, CardHeader, Button, Input, Badge } from '@/components/ui';
import { InviteModal } from '@/components/organization/InviteModal';
import { MembersTab } from '@/components/organization/MembersTab';
import { roleConfig } from '@/components/organization/roles';
import { useAuth } from '@/lib/auth';
import { formatBytes } from '@/lib/utils';
import {
  OrganizationService,
  describeOrgError,
  type OrgDetails,
  type OrgInviteItem,
  type OrgMemberItem,
  type OrgRole,
} from '@/services/organization.service';

const tabs = [
  { id: 'details', label: 'Organization Details', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
];

const roleHelp: Record<OrgRole, string> = {
  owner: 'Full control of the organization. Cannot be removed.',
  admin: 'Rename the organization and manage researchers.',
  researcher: 'View projects, results and members. Cannot manage members.',
};

export function OrganizationPage() {
  const { refreshProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [details, setDetails] = useState<OrgDetails | null>(null);
  const [members, setMembers] = useState<OrgMemberItem[]>([]);
  const [invites, setInvites] = useState<OrgInviteItem[] | null>(null);
  const [invitesTruncated, setInvitesTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const d = await OrganizationService.get();
      const [m, i] = await Promise.all([
        OrganizationService.members(),
        d.permissions.canInvite ? OrganizationService.invites() : Promise.resolve(null),
      ]);
      setDetails(d);
      setOrgName(d.organization.name);
      setMembers(m);
      setInvites(i ? i.items : null);
      setInvitesTruncated(i ? i.truncated : false);
    } catch (err) {
      setLoadError(describeOrgError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A member who left or was removed from another screen must not keep seeing this organisation.
  const afterChange = async () => {
    await load();
    await refreshProfile();
  };

  const saveName = async () => {
    setSaving(true);
    setSaveError('');
    setSaved(false);
    try {
      await OrganizationService.rename(orgName);
      await afterChange();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(describeOrgError(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={22} className="animate-spin text-ink-400" /></div>;
  }
  if (loadError || !details) {
    return (
      <div role="alert" className="mx-auto max-w-md rounded-xl border border-err-500/20 bg-err-500/[0.06] p-6 text-center">
        <AlertCircle size={20} className="mx-auto text-err-400" />
        <p className="mt-2 text-sm text-err-400">{loadError || 'Could not load the organization.'}</p>
        <Button className="mt-4" size="sm" variant="secondary" onClick={() => { setLoading(true); void load(); }}>Try again</Button>
      </div>
    );
  }

  const org = details.organization;
  const usage = details.usage;
  const countRole = (role: OrgRole) => members.filter((m) => m.role === role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Organization</h2>
          <p className="mt-1 text-sm text-ink-400">{org.name}</p>
        </div>
        {details.permissions.canInvite && (
          <Button leftIcon={<UserPlus size={15} />} onClick={() => setShowInvite(true)}>Invite Member</Button>
        )}
      </div>

      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/40 p-1">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'}`}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }} className="space-y-6">
          {activeTab === 'details' && (
            <div className="mx-auto max-w-2xl space-y-6">
              <Card padding="lg">
                <CardHeader title="Organization Details" subtitle="Update your organization name" icon={<Building2 size={16} />} />
                <div className="mt-5 space-y-4">
                  {saveError && (
                    <div role="alert" className="rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">{saveError}</div>
                  )}
                  <Input label="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)}
                    leftIcon={<Building2 size={15} />} disabled={!details.permissions.canEdit}
                    hint={details.permissions.canEdit ? undefined : 'Only an owner or administrator can rename the organization.'} />
                  <Input label="Slug" value={org.slug} disabled hint="Used in URLs and API references." />
                  <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                    <div>
                      <p className="text-sm text-ink-100">Current plan</p>
                      <p className="text-xs text-ink-400">{org.plan.charAt(0).toUpperCase() + org.plan.slice(1)}</p>
                    </div>
                    <Badge tone="slate">No limits set</Badge>
                  </div>
                  {details.permissions.canEdit && (
                    <Button leftIcon={saved ? <Check size={15} /> : undefined} onClick={saveName}
                      disabled={saving || orgName.trim() === org.name || orgName.trim() === ''}>
                      {saved ? 'Saved' : saving ? 'Saving…' : 'Save Changes'}
                    </Button>
                  )}
                </div>
              </Card>

              {usage && (
                <Card padding="lg">
                  <CardHeader title="Usage" subtitle="Counted from your stored records. No quotas are set yet." icon={<Shield size={16} />} />
                  <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      ['Members', usage.members], ['Projects', usage.projects], ['Videos', usage.uploads],
                      ['Storage used', formatBytes(usage.storageBytes)], ['Analysis jobs', usage.jobsTotal],
                      ['Queued or running', usage.jobsRunning], ['Reports', usage.reports],
                    ].map(([label, value]) => (
                      <div key={label as string} className="rounded-lg border border-white/[0.06] bg-ink-900/40 p-3">
                        <dt className="text-xs text-ink-400">{label}</dt>
                        <dd className="mt-1 text-lg font-semibold text-white">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              )}
            </div>
          )}

          {activeTab === 'members' && <MembersTab members={members} invites={invites} invitesTruncated={invitesTruncated} onChanged={afterChange} />}

          {activeTab === 'roles' && (
            <div className="space-y-4">
              {(['owner', 'admin', 'researcher'] as OrgRole[]).map((role) => {
                const cfg = roleConfig[role];
                const RoleIcon = cfg.icon;
                const roleMembers = countRole(role);
                return (
                  <Card key={role} padding="md">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.04] text-ink-200 ring-1 ring-inset ring-white/[0.06]">
                        <RoleIcon size={16} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-white">{cfg.label}s</h3>
                        <p className="text-xs text-ink-400">{roleHelp[role]}</p>
                      </div>
                      <span className="text-sm text-ink-400">{roleMembers.length}</span>
                    </div>
                    {roleMembers.length > 0 && (
                      <div className="mt-4 divide-y divide-white/[0.04] border-t border-white/[0.04] pt-3">
                        {roleMembers.map((m) => (
                          <div key={m.id} className="py-2 text-sm text-ink-200">{m.name || m.email}{m.isYou ? ' (you)' : ''}</div>
                        ))}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <InviteModal open={showInvite} onClose={() => setShowInvite(false)} myRole={details.role} onCreated={() => void load()} />
    </div>
  );
}
