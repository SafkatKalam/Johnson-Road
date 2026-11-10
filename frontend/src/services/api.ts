import axios from 'axios';
import { supabase } from '@/lib/supabase';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Every API call carries the signed-in person's access token. The backend checks it on every request;
// nothing in the browser (a stored flag, a role) is trusted as proof of who the caller is.
api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** Sent when the server says our token is no longer valid. The AuthProvider listens and signs out. */
export const SESSION_EXPIRED_EVENT = 'jr:session-expired';

/** Sent when the server says the person's organisation membership is gone or suspended. The AuthProvider reloads the account. */
export const MEMBERSHIP_CHANGED_EVENT = 'jr:membership-changed';

const MEMBERSHIP_CODES = new Set(['onboarding_required', 'membership_suspended', 'account_suspended']);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error?.config?.headers?.Authorization);
    const isAccountCall = String(error?.config?.url ?? '').endsWith('/me'); // the provider handles that one itself
    if (error?.response?.status === 401 && sentToken && !isAccountCall) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    const code = error?.response?.data?.error?.code;
    if (error?.response?.status === 403 && sentToken && !isAccountCall && MEMBERSHIP_CODES.has(code)) {
      window.dispatchEvent(new Event(MEMBERSHIP_CHANGED_EVENT));
    }
    return Promise.reject(error);
  }
);
