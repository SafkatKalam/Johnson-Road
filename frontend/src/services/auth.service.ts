import { isAxiosError } from 'axios';
import type { AuthChangeEvent, Session, Subscription } from '@supabase/supabase-js';
import { clearRecoverySession, supabase } from '@/lib/supabase';
import { api } from '@/services/api';

/** What `GET /api/me` returns (backend PostgreSQL is the record; Supabase only signs people in). */
export interface AccountResponse {
  user: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl: string | null;
    status: string;
  };
  organization: { id: string; name: string; slug: string; plan: string } | null;
  role: 'owner' | 'admin' | 'researcher' | null;
  membershipStatus: string | null;
  needsOnboarding: boolean;
}

/** An error whose message is safe to show to the person. */
export class AuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

interface ProviderError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Turns a Supabase error into plain words. The provider's own text is never shown. */
export function friendlyAuthError(error: ProviderError): AuthError {
  const code = error.code ?? '';
  const text = (error.message ?? '').toLowerCase();

  if (code === 'invalid_credentials' || text.includes('invalid login credentials')) {
    return new AuthError('invalid_credentials', 'Incorrect email or password.');
  }
  if (code === 'email_not_confirmed' || text.includes('email not confirmed')) {
    return new AuthError('email_not_confirmed', 'Please confirm your email address first. Check your inbox for the link.');
  }
  if (code === 'user_already_exists' || text.includes('already registered')) {
    return new AuthError('user_already_exists', 'An account with this email already exists. Try signing in.');
  }
  if (code === 'weak_password') {
    return new AuthError('weak_password', 'That password is too weak. Use at least 8 characters.');
  }
  if (code === 'same_password') {
    return new AuthError('same_password', 'Choose a password you have not used before.');
  }
  if (code === 'session_not_found' || code === 'session_expired' || code === 'refresh_token_not_found') {
    return new AuthError('session_expired', 'Your sign-in has expired. Please sign in again.');
  }
  if (code === 'signup_disabled') {
    return new AuthError('signup_disabled', 'New sign-ups are turned off right now.');
  }
  if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || error.status === 429) {
    return new AuthError('rate_limited', 'Too many attempts. Please wait a few minutes and try again.');
  }
  if (error.name === 'AuthRetryableFetchError' || error.status === 0 || text.includes('failed to fetch')) {
    return new AuthError('network', 'Could not reach the sign-in service. Check your connection and try again.');
  }
  return new AuthError('unknown', 'Something went wrong. Please try again.');
}

/** What to tell the person when the Johnson Road server would not give us their account. */
export function describeAccountError(error: unknown): string {
  if (isAxiosError(error)) {
    const code = (error.response?.data as { error?: { code?: string; message?: string } } | undefined)?.error?.code;
    if (code === 'account_suspended') return 'This account is suspended. Please contact support.';
    if (code === 'membership_suspended') return 'Your membership of this organisation is suspended. Please contact support.';
    if (code === 'email_in_use') {
      return 'This email address is already linked to a different sign-in. Please contact support.';
    }
    if (!error.response || error.response.status >= 500) {
      return 'We could not reach the Johnson Road server. Please try again in a moment.';
    }
  }
  return 'We could not load your account. Please try again.';
}

/** Removes the browser's stored Supabase session, whatever the provider call answered. */
function removeStoredSession(): void {
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* storage can be blocked; nothing is stored then */
  }
}

// Signing out clears the screen first and then tells the server, which takes a moment. If the page is reloaded in
// that moment, the browser can cancel the request and the stored session would sign the person back in. So the
// start of a sign-out is written down, and the next page load finishes the job before restoring anything.
const SIGNING_OUT_KEY = 'jr-signing-out';

function setSigningOut(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(SIGNING_OUT_KEY, '1');
    else sessionStorage.removeItem(SIGNING_OUT_KEY);
  } catch {
    /* storage can be blocked; the stored session is then removed on failure by logout() itself */
  }
}

function signOutWasInterrupted(): boolean {
  try {
    return sessionStorage.getItem(SIGNING_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

export const AuthService = {
  beginSignOut: () => setSigningOut(true),
  endSignOut: () => setSigningOut(false),
  signOutWasInterrupted,

  /** Create an account. Returns whether the person must confirm their email before signing in. */
  async register(fullName: string, email: string, password: string): Promise<{ needsEmailConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      // The link in the email brings the person back here (must be in Supabase's Redirect URLs list).
      options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw friendlyAuthError(error);
    // With "Confirm email" on, an address that already has an account comes back as a user with no identities
    // and no error (so that attackers cannot probe for accounts). Never treat that as a new account.
    if (!data.user || (data.user.identities && data.user.identities.length === 0)) {
      throw new AuthError('user_already_exists', 'An account with this email already exists. Try signing in.');
    }
    return { needsEmailConfirmation: !data.session };
  },

  /** Send the confirmation email again. Throws a plain-words error (for example when Supabase rate-limits it). */
  async resendConfirmation(email: string): Promise<void> {
    if (!email) {
      throw new AuthError('missing_fields', 'Enter your email address on the sign-up page again to request a new link.');
    }
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error) throw friendlyAuthError(error);
  },

  async login(email: string, password: string): Promise<void> {
    if (!email || !password) {
      throw new AuthError('missing_fields', 'Please enter your email and password.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw friendlyAuthError(error);
  },

  /**
   * Send a password-reset email. Supabase answers the same whether or not the address has an account, and so
   * does this: the caller must not say anything that confirms or denies an account exists.
   */
  async requestPasswordReset(email: string): Promise<void> {
    if (!email) throw new AuthError('missing_fields', 'Please enter your email address.');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      const mapped = friendlyAuthError(error);
      // Only a broken connection is reported. A sending limit or a failed send happens for addresses that HAVE
      // an account but not for unknown ones, so reporting it would show which addresses exist: answer the same.
      if (mapped.code === 'network') throw mapped;
    }
  },

  /** Set a new password for the current session, then end every OTHER device's session (policy for F13/F14). */
  async updatePassword(newPassword: string): Promise<void> {
    if (newPassword.length < 8) throw new AuthError('weak_password', 'Password must be at least 8 characters.');
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw friendlyAuthError(error);
    clearRecoverySession();
    // Anyone who knew the old password and is signed in elsewhere must not stay signed in. Best effort:
    // the password is already changed, so a failure here is not shown as a failure of the change.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined);
  },

  /** Change the password from the profile page: the current password is checked first (open item O27 default). */
  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    if (!currentPassword) throw new AuthError('missing_fields', 'Please enter your current password.');
    if (currentPassword === newPassword) {
      throw new AuthError('same_password', 'Choose a password you have not used before.');
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password: currentPassword });
    if (error) {
      const mapped = friendlyAuthError(error);
      throw mapped.code === 'invalid_credentials'
        ? new AuthError('wrong_current_password', 'Your current password is not correct.')
        : mapped;
    }
    await AuthService.updatePassword(newPassword);
  },

  /** End this device's session only (the server keeps other devices signed in). */
  async logout(): Promise<void> {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      // On a network error the library can leave the session stored, and a refresh would sign the person back in.
      removeStoredSession();
      throw friendlyAuthError(error);
    }
  },

  async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  onAuthChange(callback: (event: AuthChangeEvent, session: Session | null) => void): Subscription {
    return supabase.auth.onAuthStateChange(callback).data.subscription;
  },

  /** Who the backend says the caller is, and which organisation they belong to. */
  async loadAccount(): Promise<AccountResponse> {
    const response = await api.get<AccountResponse>('/me');
    return response.data;
  },
};
