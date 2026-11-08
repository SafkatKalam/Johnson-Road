// Links in emails send the person back to this site. A good link carries a session in the address and the
// Supabase client picks it up by itself. A bad link (expired, already used) comes back with an error in the
// address, either after "#" or after "?". The app may redirect, or the Supabase client may clear the address,
// before any page can read it, so it is captured once, as early as possible, removed from the address bar,
// and shown later on the sign-in or verify page.
let pendingNotice: string | null = null;

const CALLBACK_MESSAGES: Record<string, string> = {
  otp_expired: 'That link has expired or was already used. Request a new one and try again.',
  access_denied: 'That link is not valid any more. Request a new one and try again.',
};

const ERROR_PARAMS = ['error', 'error_code', 'error_description'];

function hasError(params: URLSearchParams): boolean {
  return params.has('error') || params.has('error_code');
}

/** Reads and clears an error that an email link left in the address bar. Safe to call more than once. */
export function captureCallbackNotice(): void {
  if (typeof window === 'undefined') return;
  const hash = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
  const query = new URLSearchParams(window.location.search);
  // Whole parameters only: a good "#access_token=..." may contain the letters "error" by chance and is left alone.
  const source = hasError(hash) ? hash : hasError(query) ? query : null;
  if (!source) return;

  const code = source.get('error_code') ?? source.get('error') ?? '';
  pendingNotice = CALLBACK_MESSAGES[code] ?? 'That link did not work. Request a new one and try again.';

  // Never leave the provider's error text, or anything else, in the address bar or the history.
  ERROR_PARAMS.forEach((name) => query.delete(name));
  const search = query.toString();
  window.history.replaceState(null, '', window.location.pathname + (search ? `?${search}` : ''));
}

/** The message captured from an email link, once. Returns null when there is none. */
export function takeCallbackNotice(): string | null {
  const notice = pendingNotice;
  pendingNotice = null;
  return notice;
}
