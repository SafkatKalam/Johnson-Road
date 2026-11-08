import { api } from '@/services/api';
import type { AccountResponse } from '@/services/auth.service';

export interface ProfileChanges {
  fullName?: string;
  /** An https:// address, or '' to remove the avatar. */
  avatarUrl?: string;
}

/** Turns the backend's answer into a sentence for the person. */
export function describeProfileError(error: unknown): string {
  const response = (error as { response?: { status?: number; data?: { error?: { code?: string; details?: { fields?: { field: string }[] } } } } })?.response;
  if (!response) return 'We could not reach the server. Please try again.';
  if (response.status === 422) {
    const fields = response.data?.error?.details?.fields?.map((f) => f.field) ?? [];
    if (fields.some((f) => f.endsWith('avatarUrl'))) {
      return 'The avatar address must start with https:// and be under 500 characters.';
    }
    if (fields.some((f) => f.endsWith('fullName'))) return 'Your name must be 1 to 120 characters.';
    return 'Some of the information is not valid.';
  }
  if (response.status === 401 || response.status === 403) return 'You are not allowed to change this. Please sign in again.';
  return 'We could not save your changes. Please try again.';
}

export const ProfileService = {
  /** Changes only the caller's own name and avatar address. Role, organisation and email cannot be sent. */
  async update(changes: ProfileChanges): Promise<AccountResponse> {
    const response = await api.patch<AccountResponse>('/me', changes);
    return response.data;
  },
};
