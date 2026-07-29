export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const DEMO_USER: AuthUser = {
  id: "1",
  email: "admin@johnsonroad.ai",
  name: "Safkat Kalam",
  role: "Administrator",
};

class AuthService {
  async login(email: string, password: string) {
    // Temporary authentication
    if (!email || !password) {
      throw new Error("Please enter email and password.");
    }

    localStorage.setItem("jr-auth", "true");

    return DEMO_USER;
  }

  async logout() {
    localStorage.removeItem("jr-auth");
  }

  async currentUser() {
    const logged = localStorage.getItem("jr-auth");

    if (!logged) return null;

    return DEMO_USER;
  }
}

export const authService = new AuthService();