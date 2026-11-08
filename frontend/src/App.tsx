import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SkeletonCard } from '@/components/ui';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import('@/pages/auth/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })));
const OnboardingPage = lazy(() => import('@/pages/auth/OnboardingPage').then((m) => ({ default: m.OnboardingPage })));

const ProjectsPage = lazy(() => import('@/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import('@/pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const UploadPage = lazy(() => import('@/pages/UploadPage').then((m) => ({ default: m.UploadPage })));
const ProcessingPage = lazy(() => import('@/pages/ProcessingPage').then((m) => ({ default: m.ProcessingPage })));
const ReportsPage = lazy(() => import('@/pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const JobQueuePage = lazy(() => import('@/pages/JobQueuePage').then((m) => ({ default: m.JobQueuePage })));
const SupportPage = lazy(() => import('@/pages/SupportPage').then((m) => ({ default: m.SupportPage })));
const MyProfilePage = lazy(() => import('@/pages/MyProfilePage').then((m) => ({ default: m.MyProfilePage })));
const OrganizationPage = lazy(() => import('@/pages/OrganizationPage').then((m) => ({ default: m.OrganizationPage })));
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const BillingPage = lazy(() => import('@/pages/BillingPage').then((m) => ({ default: m.BillingPage })));

function PageFallback() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

function AuthFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-ink-950"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" /></div>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, needsOnboarding } = useAuth();

  if (loading) return <AuthFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (needsOnboarding) return <Navigate to="/onboarding" replace />;

  return <>{children}</>;
}

/**
 * For /onboarding only: needs a signed-in person but NOT an organisation (that is the point of onboarding).
 * Using ProtectedRoute here would send a person without an organisation to /onboarding again and again.
 */
function SignedInRoute({ children }: { children: ReactNode }) {
  const { user, loading, needsOnboarding } = useAuth();

  if (loading) return <AuthFallback />;
  if (!user) return <Navigate to="/login" replace />;
  if (!needsOnboarding) return <Navigate to="/" replace />; // already has an organisation: nothing to set up

  return <>{children}</>;
}

function AuthRoute({ children }: { children: ReactNode }) {
  const { user, loading, needsOnboarding } = useAuth();

  if (loading) return <AuthFallback />;
  if (user && !needsOnboarding) return <Navigate to="/" replace />;
  if (user && needsOnboarding) {
    // Only redirect to onboarding from login/register — verify-email stays
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes (no layout) */}
      <Route path="/login" element={<Suspense fallback={<AuthFallback />}><AuthRoute><LoginPage /></AuthRoute></Suspense>} />
      <Route path="/register" element={<Suspense fallback={<AuthFallback />}><AuthRoute><RegisterPage /></AuthRoute></Suspense>} />
      <Route path="/forgot-password" element={<Suspense fallback={<AuthFallback />}><ForgotPasswordPage /></Suspense>} />
      <Route path="/reset-password" element={<Suspense fallback={<AuthFallback />}><ResetPasswordPage /></Suspense>} />
      <Route path="/verify-email" element={<Suspense fallback={<AuthFallback />}><VerifyEmailPage /></Suspense>} />
      <Route path="/onboarding" element={<Suspense fallback={<AuthFallback />}><SignedInRoute><OnboardingPage /></SignedInRoute></Suspense>} />

      {/* App routes (with layout) */}
      <Route path="/" element={<ProtectedRoute><Layout><DashboardPage /></Layout></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><ProjectsPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/projects/:id" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><ProjectDetailPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/upload" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><UploadPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/processing" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><ProcessingPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/job-queue" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><JobQueuePage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><ReportsPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><BillingPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><SettingsPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><MyProfilePage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/organization" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><OrganizationPage /></Suspense></Layout></ProtectedRoute>} />
      <Route path="/support" element={<ProtectedRoute><Layout><Suspense fallback={<PageFallback />}><SupportPage /></Suspense></Layout></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
