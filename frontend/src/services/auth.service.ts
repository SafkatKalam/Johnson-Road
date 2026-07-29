import { api } from '@/services/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

const DEMO_USER: AuthUser = {
  id: '1',
  email: 'admin@johnsonroad.ai',
  name: 'Safkat Kalam',
  role: 'Administrator',
};

export const AuthService = {
  async login(email: string, password: string): Promise<AuthUser> {
    if (!email || !password) {
      throw new Error('Please enter email and password.');
    }

    void api;
    localStorage.setItem('jr-auth', 'true');
    return Promise.resolve(DEMO_USER);
  },
  async logout(): Promise<void> {
    localStorage.removeItem('jr-auth');
  },
  async currentUser(): Promise<AuthUser | null> {
    const logged = localStorage.getItem('jr-auth');
    return Promise.resolve(logged ? DEMO_USER : null);
  },
};

export { DEMO_USER };
