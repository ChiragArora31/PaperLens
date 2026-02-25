'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { LogIn, UserPlus, Sparkles } from 'lucide-react';

const EMAIL_HINT = 'name@example.com';

export default function AuthPage() {
  const { status } = useSession();
  const router = useRouter();
  const [callbackUrl] = useState(() => {
    if (typeof window === 'undefined') return '/dashboard';
    const next = new URLSearchParams(window.location.search).get('next');
    return next || '/dashboard';
  });

  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const title = useMemo(
    () => (mode === 'login' ? 'Welcome back' : 'Create your PaperLens account'),
    [mode]
  );

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  if (status === 'authenticated') {
    return null;
  }

  const handleCredentials = async (event: FormEvent) => {
    event.preventDefault();
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
          setIsSubmitting(false);
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
        setIsSubmitting(false);
        return;
      }

      router.push(callbackUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
      setIsSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setIsSubmitting(true);
    await signIn('google', { callbackUrl });
  };

  return (
    <main className="gradient-bg noise-overlay min-h-screen">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-5 py-10">
        <div className="card w-full max-w-xl p-6 sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
              <Sparkles className="h-4 w-4" />
              Back to PaperLens
            </Link>
            <div className="inline-flex rounded-xl border p-1" style={{ borderColor: 'hsl(var(--border))' }}>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'login' ? 'dashboard-nav-tab-active' : ''}`}
                onClick={() => setMode('login')}
              >
                Login
              </button>
              <button
                type="button"
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${mode === 'signup' ? 'dashboard-nav-tab-active' : ''}`}
                onClick={() => setMode('signup')}
              >
                Sign up
              </button>
            </div>
          </div>

          <h1 className="section-title mb-2">{title}</h1>
          <p className="section-subtitle mb-6">
            Access your personalized dashboard with recent papers, bookmarks, and tailored recommendations.
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
                  className="w-full rounded-xl border px-4 py-2.5 text-sm"
                  style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-secondary))' }}
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
                className="w-full rounded-xl border px-4 py-2.5 text-sm"
                style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-secondary))' }}
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
                className="w-full rounded-xl border px-4 py-2.5 text-sm"
                style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-secondary))' }}
              />
            </div>

            {error && (
              <p className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'hsl(var(--accent-rose) / 0.3)', color: 'hsl(var(--accent-rose))', background: 'hsl(var(--accent-rose) / 0.08)' }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="landing-cta-primary w-full justify-center"
            >
              {mode === 'login' ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
              {mode === 'login' ? 'Login with Email' : 'Create Account'}
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: 'hsl(var(--border))' }} />
            <span className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: 'hsl(var(--text-muted))' }}>
              Or
            </span>
            <div className="h-px flex-1" style={{ background: 'hsl(var(--border))' }} />
          </div>

          <button
            onClick={handleGoogle}
            disabled={isSubmitting}
            className="w-full rounded-xl border px-4 py-2.5 text-sm font-semibold"
            style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--text-primary))', background: 'hsl(var(--bg-secondary))' }}
          >
            Continue with Google
          </button>
        </div>
      </div>
    </main>
  );
}
