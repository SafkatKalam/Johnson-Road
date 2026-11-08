import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, ArrowRight } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { takeCallbackNotice } from '@/lib/authNotice';
import { AuthError } from '@/services/auth.service';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, accountError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // A bad email link (expired or already used) leaves a message to show here. Read in an effect, not in the
  // state initialiser: React runs initialisers twice in development and the second run would find it already taken.
  useEffect(() => {
    const notice = takeCallbackNotice();
    if (notice) setError(notice);
  }, []);

const handleSubmit = async (
  e: React.FormEvent
) => {
  e.preventDefault();

  setLoading(true);

  setError("");

  try {
    await login(email, password);

    navigate("/");
  } catch (err) {
    // Signed up but never confirmed the email: take them to the page where they can ask for a new link.
    if (err instanceof AuthError && err.code === "email_not_confirmed") {
      navigate("/verify-email", { state: { email } });
      return;
    }
    if (err instanceof Error) {
      setError(err.message);
    } else {
      setError("Login failed.");
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-400">Sign in to your Johnson Road account.</p>
      </div>

      {(error || accountError) && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error || accountError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          leftIcon={<Mail size={15} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <div>
          <div className="flex items-center justify-between">
            <label className="mb-1.5 block text-xs font-medium text-ink-200">Password</label>
            <Link to="/forgot-password" className="text-xs text-brand-300 hover:text-brand-200">
              Forgot password?
            </Link>
          </div>
          <Input
            type="password"
            placeholder="Enter your password"
            leftIcon={<Lock size={15} />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading} rightIcon={<ArrowRight size={16} />}>
          {loading ? 'Signing in…' : 'Sign In'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-400">
        Don't have an account?{' '}
        <Link to="/register" className="font-medium text-brand-300 hover:text-brand-200">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}
