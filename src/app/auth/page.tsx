'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getProviders, signIn, signOut, useSession } from 'next-auth/react';
import type { ClientSafeProvider } from 'next-auth/react';
import { Loader2, LogIn, UserPlus, Sparkles } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import ThemeToggle from '@/components/ThemeToggle';

const EMAIL_HINT = 'name@example.com';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.91h5.43c-.24 1.26-.95 2.32-2.03 3.03l3.28 2.54c1.91-1.76 3.01-4.34 3.01-7.38 0-.71-.06-1.39-.18-2.05H12Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.97-.9 6.63-2.43l-3.28-2.54c-.9.61-2.05.98-3.35.98-2.58 0-4.77-1.74-5.55-4.08l-3.39 2.61A10.01 10.01 0 0 0 12 22Z"
      />
      <path
        fill="#4A90E2"
        d="M6.45 13.93a5.98 5.98 0 0 1 0-3.86l-3.39-2.61a10 10 0 0 0 0 9.08l3.39-2.61Z"
      />
      <path
        fill="#FBBC05"
        d="M12 5.99c1.47 0 2.8.51 3.84 1.5l2.88-2.88C16.96 2.98 14.7 2 12 2A10.01 10.01 0 0 0 3.06 7.46l3.39 2.61c.78-2.34 2.97-4.08 5.55-4.08Z"
      />
    </svg>
  );
}

function sanitizeNextPath(next: string | null): string {
  if (!next) return '/dashboard';
  if (!next.startsWith('/')) return '/dashboard';
  if (next.startsWith('//')) return '/dashboard';
  return next;
}

function mapOAuthError(errorCode: string): string {
  const normalized = errorCode.toLowerCase();
  if (normalized.includes('oauthaccountnotlinked')) {
    return 'This email is already linked to another login method. Sign in with your original method first.';
  }
  if (normalized.includes('oauthsignin') || normalized.includes('oauthcallback')) {
    return 'Google sign-in could not complete. Check callback URL and Google OAuth credentials.';
  }
  if (normalized.includes('accessdenied')) {
    return 'Google sign-in was cancelled or denied.';
  }
  return 'Authentication could not be completed. Please try again.';
}

export default function AuthPage() {
  const { status } = useSession();
  const router = useRouter();
  const redirectCheckedRef = useRef(false);

  const [callbackUrl] = useState(() => {
    if (typeof window === 'undefined') return '/dashboard';
    const next = new URLSearchParams(window.location.search).get('next');
    return sanitizeNextPath(next);
  });

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [googleProvider, setGoogleProvider] = useState<ClientSafeProvider | null>(null);
  const [googleState, setGoogleState] = useState<'loading' | 'available' | 'unavailable'>('loading');

  const title = useMemo(
    () => (mode === 'login' ? 'Welcome back' : 'Create your PaperLens account'),
    [mode]
  );

  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providers = await getProviders();
        if (providers?.google) {
          setGoogleProvider(providers.google);
          setGoogleState('available');
          return;
        }
      } catch {
        // Keep a graceful fallback state.
      }

      setGoogleProvider(null);
      setGoogleState('unavailable');
    };

    void loadProviders();
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const oauthError = new URLSearchParams(window.location.search).get('error');
    if (oauthError) {
      setError(mapOAuthError(oauthError));
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      redirectCheckedRef.current = false;
      return;
    }

    if (status !== 'authenticated' || redirectCheckedRef.current) return;
    redirectCheckedRef.current = true;

    const validateAndRedirect = async () => {
      try {
        const response = await fetch('/api/user/dashboard', { cache: 'no-store' });
        if (response.ok) {
          router.replace(callbackUrl);
          return;
        }

        await signOut({ redirect: false });
        setError('Session expired or invalid. Please login again.');
      } catch {
        setError('Could not validate session. Please login again.');
      }
    };

    void validateAndRedirect();
  }, [status, router, callbackUrl]);

  const handleCredentials = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError('');

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        const result = (await response.json()) as { success?: boolean; error?: string };
        if (!response.ok || !result.success) {
          setError(result.error || 'Could not create account.');
          return;
        }
      }

      const loginResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (loginResult?.error) {
        setError('Invalid login credentials.');
        return;
      }

      router.push(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (isSubmitting) return;

    if (!googleProvider) {
      setError(
        'Google sign-in is not configured on this deployment. Set GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET (or AUTH_GOOGLE_ID/AUTH_GOOGLE_SECRET).'
      );
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      await signIn(googleProvider.id, { callbackUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign in failed.');
      setIsSubmitting(false);
    }
  };

  if (status === 'authenticated' && !error) {
    return (
      <main className="auth-pro-page min-h-screen">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-5 py-10">
          <div className="auth-pro-card w-full max-w-xl p-8 text-center">
            <p className="section-title">Finishing sign in...</p>
            <p className="section-subtitle mt-2">Validating your session and opening dashboard.</p>
            <div className="mt-4 inline-flex items-center gap-2 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
              <Loader2 className="h-4 w-4 animate-spin" />
              Please wait
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-pro-page min-h-screen">
      <div className="auth-pro-grid mx-auto flex min-h-screen max-w-5xl items-center justify-center px-5 py-10">
        <div className="w-full max-w-xl">
          <div className="mb-8 flex items-center justify-center gap-3">
            <BrandMark size={50} />
            <div>
              <p className="brand-wordmark text-[2rem] leading-none">
                <span className="brand-wordmark-paper">Paper</span>
                <span className="brand-wordmark-play">Lens</span>
              </p>
              <p className="mt-1 text-center text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
                Research understanding, engineered for builders.
              </p>
            </div>
          </div>

          <div className="auth-pro-card p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'hsl(var(--text-secondary))' }}
                >
                  <Sparkles className="h-4 w-4" />
                  Back to Home
                </Link>
                <ThemeToggle />
              </div>

              <div className="auth-segmented">
                <button
                  type="button"
                  className={`auth-segmented-btn ${mode === 'login' ? 'auth-segmented-btn-active' : ''}`}
                  onClick={() => setMode('login')}
                >
                  Login
                </button>
                <button
                  type="button"
                  className={`auth-segmented-btn ${mode === 'signup' ? 'auth-segmented-btn-active' : ''}`}
                  onClick={() => setMode('signup')}
                >
                  Sign up
                </button>
              </div>
            </div>

            <h1 className="section-title mb-2">{title}</h1>
            <p className="section-subtitle mb-6">
              Access your personalized dashboard, bookmarks, and paper recommendations.
            </p>

            <form onSubmit={handleCredentials} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
                    Name
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Your name"
                    className="auth-input"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder={EMAIL_HINT}
                  autoComplete="email"
                  className="auth-input"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  className="auth-input"
                />
              </div>

              {error && (
                <p
                  className="rounded-xl border px-3 py-2 text-sm"
                  style={{
                    borderColor: 'hsl(var(--accent-rose) / 0.3)',
                    color: 'hsl(var(--accent-rose))',
                    background: 'hsl(var(--accent-rose) / 0.08)',
                  }}
                >
                  {error}
                </p>
              )}

              <button type="submit" disabled={isSubmitting} className="auth-submit-btn w-full justify-center">
                {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1" style={{ background: 'hsl(var(--border))' }} />
              <span
                className="text-xs font-semibold uppercase tracking-[0.08em]"
                style={{ color: 'hsl(var(--text-muted))' }}
              >
                OR
              </span>
              <div className="h-px flex-1" style={{ background: 'hsl(var(--border))' }} />
            </div>

            <button
              onClick={handleGoogle}
              disabled={isSubmitting || googleState === 'loading'}
              className="auth-social-btn w-full"
            >
              {googleState === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking Google sign-in...
                </>
              ) : (
                <>
                  <GoogleLogo />
                  Continue with Google
                </>
              )}
            </button>

            {googleState === 'unavailable' && (
              <p className="mt-2 text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
                Google sign-in is currently unavailable in this deployment configuration.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
