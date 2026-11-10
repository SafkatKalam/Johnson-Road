import { isAxiosError } from 'axios';
import { api } from '@/services/api';
import type { AccountResponse } from '@/services/auth.service';

export type OrgRole = 'owner' | 'admin' | 'researcher';

export interface OrgDetails {
  organization: { id: string; name: string; slug: string; plan: string; createdAt: string };
  role: OrgRole;
  permissions: { canEdit: boolean; canInvite: boolean; canSeeUsage: boolean };
  /** Counted from the stored records. null for researchers (owner and admin only). */
  usage: {
    members: number;
    projects: number;
    uploads: number;
    storageBytes: number;
    jobsTotal: number;
    jobsRunning: number;
    reports: number;
  } | null;
  /** Plan limits are not decided yet, so this is null: the screen must not invent quotas. */
  limits: null;
}

export interface OrgMemberItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: OrgRole;
  status: string;
  joinedAt: string;
  isYou: boolean;
  canChangeRole: boolean;
  canRemove: boolean;
}

export interface OrgInviteItem {
  id: string;
  email: string;
  role: 'admin' | 'researcher';
  state: 'open' | 'accepted' | 'revoked' | 'expired';
  expiresAt: string;
  createdAt: string;
  invitedBy: string;
  /** The server's answer to "may I revoke this?" (an administrator may not revoke an administrator invitation). */
  canRevoke: boolean;
}

export interface CreatedInvite {
  invite: OrgInviteItem;
  /** Shown once. The token sits after "#", so it is never sent to a server or logged. */
  acceptUrl: string;
  delivery: 'not_sent';
}

const MESSAGES: Record<string, string> = {
  already_member: 'That person already belongs to an organisation.',
  invite_already_open: 'There is already an open invitation for that address. Revoke it first to send a new one.',
  invite_invalid: 'This invitation is not valid, has expired, or was already used.',
  invite_wrong_account: 'This invitation was sent to a different email address. Sign in with the address it was sent to.',
  invite_not_open: 'That invitation can no longer be changed.',
  confirmation_unavailable: 'Invitations cannot be accepted right now. Ask your administrator to finish the sign-in setup.',
  email_not_confirmed: 'Confirm your email address first (open the link in the email we sent you), then accept the invitation.',
  organization_name_unavailable: 'Could not find a free address for that name. Try a different name.',
  forbidden: 'You are not allowed to do this.',
  account_suspended: 'This account is suspended. Please contact support.',
  membership_suspended: 'Your membership of this organisation is suspended. Please contact support.',
  auth_unavailable: 'Sign-in checking is temporarily unavailable. Please try again in a moment.',
  not_found: 'That item was not found. It may have been removed.',
  onboarding_required: 'Finish setting up your organisation first.',
};

/** The backend's error code (for example "invite_invalid"), or '' when there is none. */
export function orgErrorCode(error: unknown): string {
  if (!isAxiosError(error)) return '';
  return (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code ?? '';
}

// Wording for when the person reading it is the one the answer is about (for example on the accept-invitation page).
const SELF_MESSAGES: Record<string, string> = {
  already_member: 'You already belong to an organisation, so you cannot join another one.',
};

/**
 * Turns a backend answer into a sentence for the person. Provider or server text is never shown.
 * `subject: 'self'` is for screens where the person is the one the answer is about.
 */
export function describeOrgError(error: unknown, subject: 'other' | 'self' = 'other'): string {
  if (isAxiosError(error)) {
    if (!error.response) return 'We could not reach the server. Please try again.';
    const code = orgErrorCode(error);
    if (subject === 'self' && SELF_MESSAGES[code]) return SELF_MESSAGES[code];
    if (MESSAGES[code]) return MESSAGES[code];
    if (error.response.status === 422) return 'Some of the information is not valid. Check it and try again.';
    if (error.response.status === 401) return 'Your sign-in has expired. Please sign in again.';
    // An unexpected failure carries a diagnostic id that support can use to find it in the server log.
    const id = (error.response.data as { error?: { diagnosticId?: string | null } } | undefined)?.error?.diagnosticId;
    if (id) return `Something went wrong. Please try again. If it keeps happening, tell support this diagnostic id: ${id}`;
  }
  return 'Something went wrong. Please try again.';
}

export const OrganizationService = {
  /** First organisation for a new account: organisation and owner membership are created together. */
  async onboard(organizationName: string): Promise<AccountResponse> {
    return (await api.post<AccountResponse>('/onboarding', { organizationName })).data;
  },
  async get(): Promise<OrgDetails> {
    return (await api.get<OrgDetails>('/organization')).data;
  },
  async rename(name: string): Promise<OrgDetails['organization']> {
    return (await api.patch<{ organization: OrgDetails['organization'] }>('/organization', { name })).data.organization;
  },
  async members(): Promise<OrgMemberItem[]> {
    return (await api.get<{ items: OrgMemberItem[] }>('/organization/members')).data.items;
  },
  async changeRole(memberId: string, role: 'admin' | 'researcher'): Promise<OrgMemberItem> {
    return (await api.patch<OrgMemberItem>(`/organization/members/${memberId}`, { role })).data;
  },
  async removeMember(memberId: string): Promise<void> {
    await api.delete(`/organization/members/${memberId}`);
  },
  /** `truncated` is true when the server stopped at its limit and there are older invitations not shown. */
  async invites(): Promise<{ items: OrgInviteItem[]; truncated: boolean }> {
    const data = (await api.get<{ items: OrgInviteItem[]; truncated?: boolean }>('/organization/invites')).data;
    return { items: data.items, truncated: data.truncated === true };
  },
  async createInvite(email: string, role: 'admin' | 'researcher'): Promise<CreatedInvite> {
    return (await api.post<CreatedInvite>('/organization/invites', { email, role })).data;
  },
  async revokeInvite(inviteId: string): Promise<void> {
    await api.delete(`/organization/invites/${inviteId}`);
  },
  async acceptInvite(token: string): Promise<AccountResponse> {
    return (await api.post<AccountResponse>('/invites/accept', { token })).data;
  },
};
