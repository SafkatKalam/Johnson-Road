// An invitation link looks like  /accept-invite#token=...  The token is in the part after "#", which browsers never
// send to a server. It is read once, removed from the address bar and the history, and kept for this tab only,
// so the person can sign in first (or create an account) and then accept it.
const KEY = 'jr-pending-invite';

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Takes a token from the address bar (if one is there), scrubs the address, and returns the token to use. */
export function capturePendingInvite(): string | null {
  const hash = new URLSearchParams(window.location.hash.startsWith('#') ? window.location.hash.slice(1) : '');
  const fromAddress = hash.get('token');
  if (fromAddress) {
    try {
      sessionStorage.setItem(KEY, fromAddress);
    } catch {
      /* storage can be blocked; the token then only lives until the page changes */
    }
    // Remove the token from the address and history; keep what the router stored in the history entry.
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    return fromAddress;
  }
  return read();
}

export function hasPendingInvite(): boolean {
  return read() !== null;
}

export function clearPendingInvite(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}
