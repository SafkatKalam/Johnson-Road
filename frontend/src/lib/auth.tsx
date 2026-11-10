import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isAxiosError } from "axios";
import type { Session } from "@supabase/supabase-js";
import { clearPendingInvite } from "@/lib/pendingInvite";
import { MEMBERSHIP_CHANGED_EVENT, SESSION_EXPIRED_EVENT } from "@/services/api";
import {
  AuthError,
  AuthService,
  describeAccountError,
  type AccountResponse,
} from "@/services/auth.service";

export interface User {
  id: string;
  email: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  organization_id: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;

  loading: boolean;

  needsOnboarding: boolean;

  /** Why the account could not be loaded after the page opened (server down, account suspended), if it could not. */
  accountError: string;

  login(email: string, password: string): Promise<void>;

  /** `keepInvite`: keep a saved invitation (used by "sign out and use another account" and by session expiry). */
  signOut(options?: { keepInvite?: boolean }): Promise<void>;

  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

/** The old fake-login flag from the mock version; removed so no stale "signed in" state can survive. */
function removeLegacyFlag() {
  try {
    localStorage.removeItem("jr-auth");
  } catch {
    /* storage can be blocked; nothing to clean up then */
  }
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(true);

  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [organization, setOrganization] =
    useState<Organization | null>(null);

  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const [accountError, setAccountError] = useState("");

  // Bumped every time the account is cleared (sign-out, expired session, new load). A slow account request
  // that finishes after that is stale and must not put the old person's data back on screen.
  const generation = useRef(0);

  // The reason of the latest failed account load, readable at once (state only updates on the next render).
  const lastError = useRef("");

  const clearAccount = useCallback(() => {
    generation.current += 1;
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setNeedsOnboarding(false);
  }, []);

  const applyAccount = useCallback((account: AccountResponse) => {
    setUser({ id: account.user.id, email: account.user.email });
    setProfile({
      id: account.user.id,
      full_name: account.user.fullName,
      avatar_url: account.user.avatarUrl,
      role: account.role ?? "",
      organization_id: account.organization?.id ?? "",
    });
    setOrganization(account.organization);
    setNeedsOnboarding(account.needsOnboarding);
    setAccountError("");
  }, []);

  // One account load per access token at a time: sign-in, the page load and the auth listener can all ask
  // for it within the same moment, and the answer is the same, so they share one request.
  const inflight = useRef<{ token: string; promise: Promise<boolean> } | null>(null);

  /** Load the backend account for the current session. Returns false when nobody is signed in. */
  const syncAccount = useCallback(
    (session: Session | null): Promise<boolean> => {
      if (!session) {
        inflight.current = null;
        clearAccount();
        return Promise.resolve(false);
      }
      if (inflight.current?.token === session.access_token) return inflight.current.promise;

      const startedAt = generation.current;
      const promise = (async () => {
        try {
          const account = await AuthService.loadAccount();
          if (startedAt !== generation.current) return false; // signed out (or switched) while waiting: drop it
          lastError.current = "";
          applyAccount(account);
          return true;
        } catch (err) {
          if (startedAt !== generation.current) return false;
          clearAccount();
          lastError.current = describeAccountError(err);
          setAccountError(lastError.current);
          // 401 = the token is not valid any more: drop the stale browser session.
          if (isAxiosError(err) && err.response?.status === 401) {
            lastError.current = "";
            setAccountError("");
            await AuthService.logout().catch(() => undefined);
          }
          // Any other failure (server down, suspended, 5xx): stay signed out here, but keep the session so a
          // retry can work once the cause is fixed.
          return false;
        } finally {
          // Forget it once finished, so a later change (a new organisation, a refresh) loads again.
          if (inflight.current?.token === session.access_token) inflight.current = null;
        }
      })();
      inflight.current = { token: session.access_token, promise };
      return promise;
    },
    [applyAccount, clearAccount]
  );

  const signOut = useCallback(async (options?: { keepInvite?: boolean }) => {
    inflight.current = null;
    // A saved invitation belongs to the person who opened it, never to the next person: a plain sign-out forgets it.
    // It is kept when the person is only switching to the right account, or the session ended by itself.
    if (!options?.keepInvite) clearPendingInvite();
    AuthService.beginSignOut(); // a reload before the server answers must finish the sign-out, not undo it
    clearAccount(); // first, so nothing from this person stays on screen even if the next step is slow
    setAccountError("");
    removeLegacyFlag();
    try {
      await AuthService.logout();
    } catch {
      // The provider could not be told (offline). The stored session was removed locally anyway, so a refresh
      // does not sign the person back in. Never throw from here: the sign-out button must always finish.
    } finally {
      AuthService.endSignOut();
    }
  }, [clearAccount]);

  useEffect(() => {
    let active = true;
    removeLegacyFlag();

    // A sign-out that was cut short by a reload is finished first; the stored session is never restored.
    const firstSession = AuthService.signOutWasInterrupted()
      ? AuthService.logout()
          .catch(() => undefined)
          .finally(() => AuthService.endSignOut())
          .then(() => null)
      : AuthService.getSession();

    firstSession
      .then((session) => syncAccount(session))
      .finally(() => {
        if (active) setLoading(false);
      });

    // Keeps other tabs, token refreshes and sign-outs in step. INITIAL_SESSION is handled above.
    const subscription = AuthService.onAuthChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
      // Not awaited inside the callback: Supabase may call other Supabase functions from here and block.
      setTimeout(() => {
        if (active) void syncAccount(session);
      }, 0);
    });

    // The server refused our token on an ordinary call (expired, revoked): end this session here too.
    const onExpired = () => {
      if (active) void signOut({ keepInvite: true }); // the session ended by itself: do not lose a saved invitation
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);

    // The server says our membership changed (removed, suspended) while a screen was open: load the account again,
    // so the guards send the person where they belong instead of showing "try again" forever.
    const onMembershipChanged = () => {
      if (active) void AuthService.getSession().then((session) => syncAccount(session));
    };
    window.addEventListener(MEMBERSHIP_CHANGED_EVENT, onMembershipChanged);

    return () => {
      active = false;
      subscription.unsubscribe();
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
      window.removeEventListener(MEMBERSHIP_CHANGED_EVENT, onMembershipChanged);
    };
  }, [syncAccount, signOut]);

  async function login(email: string, password: string) {
    lastError.current = "";
    setAccountError("");
    await AuthService.login(email, password);

    const session = await AuthService.getSession();
    const ok = await syncAccount(session);

    if (!ok) {
      // Signed in at the provider but the Johnson Road server would not confirm the account:
      // do not stay half signed in. Say why, in plain words.
      const message = lastError.current || "We could not load your account. Please try again.";
      await AuthService.logout().catch(() => undefined);
      lastError.current = "";
      setAccountError("");
      throw new AuthError("account_unavailable", message);
    }
  }

  async function refreshProfile() {
    await syncAccount(await AuthService.getSession());
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        organization,
        loading,

        needsOnboarding,

        accountError,

        login,

        signOut,

        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
