import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { Input, Button } from '@/components/ui';
import { AuthService } from '@/services/auth.service';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await AuthService.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-400">
          Enter your email and we'll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="py-6 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/12 text-brand-300 ring-1 ring-brand-500/20">
            <CheckCircle2 size={28} />
          </div>
          <h3 className="mt-4 text-sm font-semibold text-white">Check your inbox</h3>
          <p className="mt-2 text-sm text-ink-400">
            If an account exists for <span className="font-medium text-ink-200">{email}</span>, we've sent a password reset link.
          </p>
          <Link to="/login" className="mt-5 inline-block">
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Back to sign in
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-lg border border-err-500/20 bg-err-500/[0.06] px-3 py-2.5 text-sm text-err-400">
              <AlertCircle size={15} /> {error}
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
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-400">
            Remember your password?{' '}
            <Link to="/login" className="font-medium text-brand-300 hover:text-brand-200">
              Sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
