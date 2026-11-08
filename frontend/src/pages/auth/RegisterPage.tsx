import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, AlertCircle, ArrowRight, Check } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { AuthService } from '@/services/auth.service';

export function RegisterPage() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);

    try {
      const { needsEmailConfirmation } = await AuthService.register(fullName, email, password);
      // With email confirmation off the person is already signed in: load the account first, so the route
      // guards see a signed-in person and do not bounce them to the sign-in page.
      if (!needsEmailConfirmation) await refreshProfile();
      navigate(needsEmailConfirmation ? '/verify-email' : '/', {
        state: needsEmailConfirmation ? { email } : undefined, // router state, not the URL: no personal data in addresses
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Create your account</h1>
        <p className="mt-1 text-sm text-ink-400">Start analyzing traffic with AI in minutes.</p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
          <AlertCircle size={15} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full name"
          placeholder="Shadiatun Alam"
          leftIcon={<User size={15} />}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
          autoComplete="name"
        />
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
        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          leftIcon={<Lock size={15} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <Input
          label="Confirm password"
          type="password"
          placeholder="Re-enter your password"
          leftIcon={<Lock size={15} />}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />

        <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-ink-900/40 px-3 py-2.5 text-xs text-ink-400">
          <Check size={14} className="mt-0.5 shrink-0 text-brand-400" />
          By creating an account, you agree to our Terms of Service and Privacy Policy.
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading} rightIcon={<ArrowRight size={16} />}>
          {loading ? 'Creating account…' : 'Create Account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-300 hover:text-brand-200">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
