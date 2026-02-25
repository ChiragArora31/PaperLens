'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { Bookmark, ExternalLink, History, LogOut, Sparkles } from 'lucide-react';

interface UserPaper {
  arxivId: string;
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  viewedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Recommendation {
  arxivId: string;
  title: string;
  summary: string;
  categories: string[];
  published: string;
  url: string;
}

interface DashboardPayload {
  recents: UserPaper[];
  bookmarks: UserPaper[];
  recommendations: Recommendation[];
}

function formatDate(value?: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PersonalizedDashboardPage() {
  const { status } = useSession();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const bookmarkIds = useMemo(
    () => new Set(payload?.bookmarks.map((paper) => paper.arxivId) ?? []),
    [payload]
  );

  const loadDashboard = async () => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/dashboard', { cache: 'no-store' });
      if (response.status === 401) {
        window.location.href = '/auth?next=/dashboard';
        return;
      }

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: DashboardPayload;
      };

      if (!response.ok || !result.success || !result.data) {
        setError(result.error || 'Unable to load dashboard.');
        setPayload(null);
        return;
      }

      setPayload(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load dashboard.');
      setPayload(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      window.location.href = '/auth?next=/dashboard';
      return;
    }
    if (status === 'authenticated') {
      void loadDashboard();
    }
  }, [status]);

  const toggleBookmark = async (paper: UserPaper | Recommendation) => {
    const isBookmarked = bookmarkIds.has(paper.arxivId);
    const method = isBookmarked ? 'DELETE' : 'POST';
    const url = isBookmarked
      ? `/api/user/bookmarks?arxivId=${encodeURIComponent(paper.arxivId)}`
      : '/api/user/bookmarks';

    const body = !isBookmarked
      ? JSON.stringify({
          arxivId: paper.arxivId,
          title: paper.title,
          abstract: 'summary' in paper ? paper.summary : paper.abstract,
          categories: paper.categories,
          authors: 'authors' in paper ? paper.authors : [],
        })
      : undefined;

    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body,
    });

    if (response.ok) {
      await loadDashboard();
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <main className="gradient-bg noise-overlay min-h-screen">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="card p-6">Loading personalized dashboard...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="gradient-bg noise-overlay min-h-screen">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-8">
        <div className="card mb-8 flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-blue))' }}>
              Personalized Dashboard
            </p>
            <h1 className="section-title mt-1">Your paper workspace</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-xl border px-3 py-2 text-sm font-semibold" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--text-secondary))' }}>
              Back to Home
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="rounded-xl border px-3 py-2 text-sm font-semibold"
              style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--text-secondary))' }}
            >
              <span className="inline-flex items-center gap-1.5">
                <LogOut className="h-4 w-4" />
                Sign out
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border px-4 py-3 text-sm" style={{ borderColor: 'hsl(var(--accent-rose) / 0.3)', color: 'hsl(var(--accent-rose))', background: 'hsl(var(--accent-rose) / 0.08)' }}>
            {error}
          </div>
        )}

        <div className="space-y-8">
          <section>
            <div className="mb-3 flex items-center gap-2">
              <History className="h-4 w-4" style={{ color: 'hsl(var(--accent-teal))' }} />
              <h2 className="landing-section-label">Recently viewed papers</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(payload?.recents ?? []).length === 0 && (
                <div className="card p-4 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
                  Analyze a paper and it will appear here.
                </div>
              )}
              {(payload?.recents ?? []).map((paper) => (
                <article key={`recent-${paper.arxivId}`} className="card p-4">
                  <h3 className="mb-2 text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{paper.title}</h3>
                  <p className="reading-small mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {paper.abstract || 'No abstract available.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noopener noreferrer" className="stat-pill">
                      <ExternalLink className="h-3.5 w-3.5" />
                      arXiv:{paper.arxivId}
                    </a>
                    <button onClick={() => toggleBookmark(paper)} className="stat-pill">
                      <Bookmark className="h-3.5 w-3.5" />
                      {bookmarkIds.has(paper.arxivId) ? 'Bookmarked' : 'Bookmark'}
                    </button>
                    {paper.viewedAt && (
                      <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                        Viewed {formatDate(paper.viewedAt)}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Bookmark className="h-4 w-4" style={{ color: 'hsl(var(--accent-indigo))' }} />
              <h2 className="landing-section-label">Bookmarked papers</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(payload?.bookmarks ?? []).length === 0 && (
                <div className="card p-4 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
                  Bookmark papers to build your research library.
                </div>
              )}
              {(payload?.bookmarks ?? []).map((paper) => (
                <article key={`bookmark-${paper.arxivId}`} className="card p-4">
                  <h3 className="mb-2 text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{paper.title}</h3>
                  <p className="reading-small mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {paper.abstract || 'No abstract available.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noopener noreferrer" className="stat-pill">
                      <ExternalLink className="h-3.5 w-3.5" />
                      arXiv:{paper.arxivId}
                    </a>
                    <button onClick={() => toggleBookmark(paper)} className="stat-pill">
                      <Bookmark className="h-3.5 w-3.5" />
                      Remove bookmark
                    </button>
                    {paper.updatedAt && (
                      <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                        Saved {formatDate(paper.updatedAt)}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: 'hsl(var(--accent-amber))' }} />
              <h2 className="landing-section-label">Recommended for you</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(payload?.recommendations ?? []).length === 0 && (
                <div className="card p-4 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
                  Add some bookmarks and we will recommend closely related papers.
                </div>
              )}
              {(payload?.recommendations ?? []).map((paper) => (
                <article key={`rec-${paper.arxivId}`} className="card p-4">
                  <h3 className="mb-2 text-lg font-bold" style={{ color: 'hsl(var(--text-primary))' }}>{paper.title}</h3>
                  <p className="reading-small mb-3" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {paper.summary}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a href={paper.url} target="_blank" rel="noopener noreferrer" className="stat-pill">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open paper
                    </a>
                    <button onClick={() => toggleBookmark(paper)} className="stat-pill">
                      <Bookmark className="h-3.5 w-3.5" />
                      {bookmarkIds.has(paper.arxivId) ? 'Bookmarked' : 'Bookmark'}
                    </button>
                    <span className="text-xs font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                      {formatDate(paper.published)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
