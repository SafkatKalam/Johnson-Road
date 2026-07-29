import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

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

interface AuthContextValue {
  session: unknown;
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;
  loading: boolean;
  needsOnboarding: boolean;

  signOut(): Promise<void>;

  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  organization: null,
  loading: true,
  needsOnboarding: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

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

  useEffect(() => {
    const logged =
      localStorage.getItem("jr-auth") === "true";

    if (logged) {
      setUser({
        id: "1",
        email: "demo@johnsonroad.ai",
      });

      setProfile({
        id: "1",
        full_name: "Safkat Kalam",
        avatar_url: null,
        role: "Administrator",
        organization_id: "org-1",
      });

      setOrganization({
        id: "org-1",
        name: "Johnson Road",
        slug: "johnson-road",
        plan: "Pro",
      });
    }

    setLoading(false);
  }, []);

  async function signOut() {
    localStorage.removeItem("jr-auth");

    window.location.href = "/login";
  }

  async function refreshProfile() {}

  return (
    <AuthContext.Provider
      value={{
        session: null,
        user,
        profile,
        organization,
        loading,
        needsOnboarding: false,
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