import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  Users,
  Crown,
  Shield,
  FlaskConical,
  UserPlus,
  Mail,
  MoreVertical,
  Trash2,
  Check,
  Loader2,
} from 'lucide-react';
import { Card, CardHeader, Button, Input, Select, Badge, Modal, EmptyState } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase, type OrgMember, type MemberRole } from '@/lib/supabase';

const roleConfig: Record<MemberRole, { icon: typeof Crown; tone: 'brand' | 'sky' | 'slate'; label: string }> = {
  owner: { icon: Crown, tone: 'brand', label: 'Owner' },
  admin: { icon: Shield, tone: 'sky', label: 'Administrator' },
  researcher: { icon: FlaskConical, tone: 'slate', label: 'Researcher' },
};

const tabs = [
  { id: 'details', label: 'Organization Details', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
];

export function OrganizationPage() {
  const { user, profile, organization } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<MemberRole>('researcher');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSaved, setOrgSaved] = useState(false);

  useEffect(() => {
    setOrgName(organization?.name || '');
  }, [organization]);

  const fetchMembers = async () => {
    if (!organization) return;
    setLoadingMembers(true);
    const { data } = await supabase
      .from('organization_members')
      .select('*')
      .eq('organization_id', organization.id)
      .order('created_at', { ascending: true });
    setMembers((data as OrgMember[]) ?? []);
    setLoadingMembers(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [organization]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    if (!organization) return;
    if (!inviteEmail.trim()) {
      setInviteError('Email is required.');
      return;
    }

    setInviting(true);
    const { error } = await supabase
      .from('organization_members')
      .insert({
        organization_id: organization.id,
        invited_email: inviteEmail.trim(),
        role: inviteRole,
        status: 'invited',
      });

    setInviting(false);

    if (error) {
      setInviteError(error.message);
      return;
    }

    setShowInvite(false);
    setInviteEmail('');
    setInviteError('');
    fetchMembers();
  };

  const handleSaveOrg = async () => {
    if (!organization) return;
    setSavingOrg(true);
    await supabase.from('organizations').update({ name: orgName }).eq('id', organization.id);
    setSavingOrg(false);
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2500);
  };

  const groupedByRole = (role: MemberRole) => members.filter((m) => m.role === role);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Organization</h2>
          <p className="mt-1 text-sm text-ink-400">{organization?.name || 'No organization'}</p>
        </div>
        <Button leftIcon={<UserPlus size={15} />} onClick={() => setShowInvite(true)}>
          Invite Member
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/40 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'bg-white/[0.08] text-white' : 'text-ink-300 hover:bg-white/[0.04] hover:text-white'
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
          className="space-y-6"
        >
          {/* DETAILS */}
          {activeTab === 'details' && (
            <Card padding="lg" className="mx-auto max-w-2xl">
              <CardHeader title="Organization Details" subtitle="Update your organization name and settings" icon={<Building2 size={16} />} />
              <div className="mt-5 space-y-4">
                <Input label="Organization name" value={orgName} onChange={(e) => setOrgName(e.target.value)} leftIcon={<Building2 size={15} />} />
                <Input label="Slug" value={organization?.slug || ''} disabled hint="Used in URLs and API references." />
                <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-ink-900/40 p-4">
                  <div>
                    <p className="text-sm text-ink-100">Current plan</p>
                    <p className="text-xs text-ink-400">{organization?.plan ? organization.plan.charAt(0).toUpperCase() + organization.plan.slice(1) : '—'}</p>
                  </div>
                  <Badge tone="brand">Active</Badge>
                </div>
                <Button leftIcon={orgSaved ? <Check size={15} /> : undefined} onClick={handleSaveOrg} disabled={savingOrg}>
                  {orgSaved ? 'Saved' : savingOrg ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </Card>
          )}

          {/* MEMBERS */}
          {activeTab === 'members' && (
            <Card padding="none">
              <div className="border-b border-white/[0.06] px-5 py-4">
                <h3 className="text-sm font-semibold text-white">Members</h3>
                <p className="mt-1 text-xs text-ink-400">{members.length} member{members.length !== 1 ? 's' : ''} in this organization.</p>
              </div>
              {loadingMembers ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-ink-400" />
                </div>
              ) : members.length === 0 ? (
                <EmptyState icon={Users} title="No members yet" description="Invite team members to collaborate on projects." />
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {members.map((m) => {
                    const cfg = roleConfig[m.role];
                    const RoleIcon = cfg.icon;
                    const isYou = m.user_id === user?.id;
                    return (
                      <div key={m.id} className="flex items-center gap-4 px-5 py-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-sm font-bold text-ink-950">
                          {(m.invited_email || m.user_id || '?').slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-ink-100">
                              {m.invited_email || (isYou ? profile?.full_name : 'Team member')}
                              {isYou && <span className="ml-1.5 text-xs text-ink-400">(you)</span>}
                            </p>
                          </div>
                          <p className="mt-0.5 text-xs text-ink-400">
                            {m.invited_email || 'Joined'} · {m.status === 'invited' ? 'Invitation sent' : 'Active'}
                          </p>
                        </div>
                        <Badge tone={cfg.tone}>
                          <RoleIcon size={11} className="mr-1" /> {cfg.label}
                        </Badge>
                        {m.status === 'invited' && <Badge tone="amber">Pending</Badge>}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {/* ROLES */}
          {activeTab === 'roles' && (
            <div className="space-y-4">
              {(['owner', 'admin', 'researcher'] as MemberRole[]).map((role) => {
                const cfg = roleConfig[role];
                const RoleIcon = cfg.icon;
                const roleMembers = groupedByRole(role);
                return (
                  <Card key={role} padding="md">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-inset ${
                        cfg.tone === 'brand' ? 'bg-brand-500/12 text-brand-300 ring-brand-500/20' :
                        cfg.tone === 'sky' ? 'bg-accent-500/12 text-accent-400 ring-accent-500/20' :
                        'bg-white/[0.04] text-ink-200 ring-white/[0.06]'
                      }`}>
                        <RoleIcon size={16} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-white">{cfg.label}s</h3>
                        <p className="text-xs text-ink-400">
                          {role === 'owner' && 'Full access including billing and deletion.'}
                          {role === 'admin' && 'Manage projects, members, and API keys.'}
                          {role === 'researcher' && 'View and analyze projects. Cannot manage members.'}
                        </p>
                      </div>
                      <span className="text-sm text-ink-400">{roleMembers.length}</span>
                    </div>
                    {roleMembers.length > 0 && (
                      <div className="mt-4 divide-y divide-white/[0.04] border-t border-white/[0.04] pt-3">
                        {roleMembers.map((m) => (
                          <div key={m.id} className="flex items-center gap-3 py-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-accent-500 text-[10px] font-bold text-ink-950">
                              {(m.invited_email || m.user_id || '?').slice(0, 2).toUpperCase()}
                            </div>
                            <span className="text-sm text-ink-200">{m.invited_email || (m.user_id === user?.id ? profile?.full_name : 'Member')}</span>
                            {m.status === 'invited' && <Badge tone="amber">Pending</Badge>}
                          </div>
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

      {/* Invite Member Modal */}
      <Modal
        open={showInvite}
        onClose={() => setShowInvite(false)}
        title="Invite Member"
        description="Send an invitation to join your organization."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowInvite(false)}>Cancel</Button>
            <Button onClick={handleInvite} disabled={inviting} leftIcon={inviting ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}>
              {inviting ? 'Sending…' : 'Send Invite'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleInvite} className="space-y-4">
          {inviteError && (
            <div className="rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
              {inviteError}
            </div>
          )}
          <Input label="Email address" type="email" placeholder="colleague@example.com" leftIcon={<Mail size={15} />} value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          <Select label="Role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as MemberRole)}>
            <option value="researcher">Researcher — view and analyze projects</option>
            <option value="admin">Administrator — manage projects and members</option>
          </Select>
        </form>
      </Modal>
    </div>
  );
}
