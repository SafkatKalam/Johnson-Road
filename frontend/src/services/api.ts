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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const sentToken = Boolean(error?.config?.headers?.Authorization);
    const isAccountCall = String(error?.config?.url ?? '').endsWith('/me'); // the provider handles that one itself
    if (error?.response?.status === 401 && sentToken && !isAccountCall) {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  }
);
