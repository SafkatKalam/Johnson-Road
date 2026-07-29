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

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  organization: Organization | null;

  loading: boolean;

  needsOnboarding: boolean;

  login(email: string, password: string): Promise<void>;

  signOut(): Promise<void>;

  refreshProfile(): Promise<void>;
}

const AuthContext = createContext<AuthContextType>(null!);

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

  const loadUser = () => {
    const logged =
      localStorage.getItem("jr-auth") === "true";

    if (!logged) {
      setUser(null);
      setProfile(null);
      setOrganization(null);
      return;
    }

    setUser({
      id: "1",
      email: "admin@johnsonroad.ai",
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
  };

  useEffect(() => {
    loadUser();

    setLoading(false);
  }, []);

  async function login(
    email: string,
    password: string
  ) {
    if (!email || !password) {
      throw new Error("Email and password required.");
    }

    localStorage.setItem("jr-auth", "true");

    loadUser();
  }

  async function signOut() {
    localStorage.removeItem("jr-auth");

    loadUser();
  }

  async function refreshProfile() {
    loadUser();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        organization,
        loading,

        needsOnboarding: false,

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