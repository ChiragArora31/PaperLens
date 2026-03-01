'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { signOut, useSession } from 'next-auth/react';
import {
  Bookmark,
  ExternalLink,
  History,
  LogOut,
  RefreshCw,
  Sparkles,
  Library,
  PanelLeftClose,
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

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

type DashboardTabId = 'recents' | 'bookmarks' | 'recommendations';

interface DashboardTab {
  id: DashboardTabId;
  label: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
}

const tabs: DashboardTab[] = [
  {
    id: 'recents',
    label: 'Recently Viewed',
    subtitle: 'Continue papers you recently explored',
    icon: History,
  },
  {
    id: 'bookmarks',
    label: 'Bookmarks',
    subtitle: 'Your saved research library',
    icon: Library,
  },
  {
    id: 'recommendations',
    label: 'Recommended',
    subtitle: 'Top papers based on your history',
    icon: Sparkles,
  },
];

function formatDate(value?: string) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function shortText(value: string, max = 180): string {
  const clean = normalizeText(value || '');
  if (!clean) return 'No description available.';
  if (clean.length <= max) return clean;
  const sample = clean.slice(0, max);
  const breakAt = Math.max(sample.lastIndexOf('. '), sample.lastIndexOf('; '), sample.lastIndexOf(', '), sample.lastIndexOf(' '));
  const cut = breakAt > max * 0.55 ? breakAt : max;
  return `${sample.slice(0, cut).trim()}...`;
}

function sectionEmpty(message: string) {
  return (
    <div className="card p-5 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
      {message}
    </div>
  );
}

export default function PersonalizedDashboardPage() {
  const { status } = useSession();
  const router = useRouter();
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<DashboardTabId>('recents');

  const bookmarkIds = useMemo(
    () => new Set(payload?.bookmarks.map((paper) => paper.arxivId) ?? []),
    [payload]
  );

  const dashboardCounts = useMemo(
    () => ({
      recents: payload?.recents.length ?? 0,
      bookmarks: payload?.bookmarks.length ?? 0,
      recommendations: Math.min(payload?.recommendations.length ?? 0, 4),
    }),
    [payload]
  );

  const loadDashboard = useCallback(async (mode: 'initial' | 'refresh' = 'initial') => {
    if (mode === 'refresh') {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError('');

    try {
      const response = await fetch('/api/user/dashboard', { cache: 'no-store' });
      if (response.status === 401) {
        setPayload(null);
        setError('Your session expired. Please login again.');
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
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      void loadDashboard();
      return;
    }

    if (status === 'unauthenticated') {
      setIsLoading(false);
      setPayload(null);
      setError('');
      router.replace('/auth?next=/dashboard');
    }
  }, [status, loadDashboard, router]);

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

    try {
      const response = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body,
      });

      if (!response.ok) {
        setError('Could not update bookmark right now. Please retry.');
        return;
      }

      await loadDashboard('refresh');
    } catch {
      setError('Could not update bookmark right now. Please retry.');
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <main className="workbench-bg noise-overlay min-h-screen">
        <div className="relative z-10 mx-auto max-w-[1200px] px-6 py-10">
          <div className="card p-6 text-[1rem] font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
            Loading your dashboard...
          </div>
        </div>
      </main>
    );
  }

  if (status !== 'authenticated') {
    return (
      <main className="workbench-bg noise-overlay min-h-screen">
        <div className="relative z-10 mx-auto max-w-4xl px-6 py-14">
          <div className="card p-8 text-center">
            <h1 className="section-title">Redirecting to login...</h1>
            <p className="section-subtitle mt-2">Preparing a secure sign-in flow for your dashboard.</p>
            <Link href="/auth?next=/dashboard" className="landing-cta-primary mx-auto mt-6 inline-flex">
              Continue to Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activeTabMeta = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const activeCount = dashboardCounts[activeTabMeta.id];
  const topRecommendations = (payload?.recommendations ?? []).slice(0, 4);

  const renderRecents = () => {
    const recents = payload?.recents ?? [];
    if (recents.length === 0) {
      return sectionEmpty('Analyze a paper and it will appear here.');
    }

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {recents.map((paper, index) => (
          <article
            key={`recent-${paper.arxivId}`}
            className="card p-5"
            style={{ borderColor: index === 0 ? 'hsl(var(--accent-teal) / 0.35)' : undefined }}
          >
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ color: 'hsl(var(--accent-teal))', borderColor: 'hsl(var(--accent-teal) / 0.35)' }}>
                Recent
              </span>
              {paper.viewedAt && (
                <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-muted))' }}>
                  {formatDate(paper.viewedAt)}
                </span>
              )}
            </div>

            <h3 className="mb-2 text-[1.24rem] font-black leading-tight tracking-[-0.02em]" style={{ color: 'hsl(var(--text-primary))' }}>
              {paper.title}
            </h3>

            <p className="mb-4 text-[0.98rem] leading-[1.72]" style={{ color: 'hsl(var(--text-secondary))' }}>
              {shortText(paper.abstract, 200)}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noopener noreferrer" className="landing-cta-primary" style={{ textDecoration: 'none', padding: '0.55rem 0.95rem', minHeight: 'unset' }}>
                <ExternalLink className="h-4 w-4" />
                Open paper
              </a>
              <button onClick={() => void toggleBookmark(paper)} className="stat-pill">
                <Bookmark className="h-3.5 w-3.5" />
                {bookmarkIds.has(paper.arxivId) ? 'Bookmarked' : 'Bookmark'}
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderBookmarks = () => {
    const bookmarks = payload?.bookmarks ?? [];
    if (bookmarks.length === 0) {
      return sectionEmpty('Bookmark papers to build your research library.');
    }

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {bookmarks.map((paper, index) => (
          <article
            key={`bookmark-${paper.arxivId}`}
            className="card p-5"
            style={{ borderColor: index === 0 ? 'hsl(var(--accent-indigo) / 0.35)' : undefined }}
          >
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ color: 'hsl(var(--accent-indigo))', borderColor: 'hsl(var(--accent-indigo) / 0.35)' }}>
                Bookmarked
              </span>
              {paper.updatedAt && (
                <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-muted))' }}>
                  Saved {formatDate(paper.updatedAt)}
                </span>
              )}
            </div>

            <h3 className="mb-2 text-[1.24rem] font-black leading-tight tracking-[-0.02em]" style={{ color: 'hsl(var(--text-primary))' }}>
              {paper.title}
            </h3>

            <p className="mb-4 text-[0.98rem] leading-[1.72]" style={{ color: 'hsl(var(--text-secondary))' }}>
              {shortText(paper.abstract, 200)}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <a href={`https://arxiv.org/abs/${paper.arxivId}`} target="_blank" rel="noopener noreferrer" className="landing-cta-primary" style={{ textDecoration: 'none', padding: '0.55rem 0.95rem', minHeight: 'unset' }}>
                <ExternalLink className="h-4 w-4" />
                Open paper
              </a>
              <button onClick={() => void toggleBookmark(paper)} className="stat-pill">
                <Bookmark className="h-3.5 w-3.5" />
                Remove bookmark
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderRecommendations = () => {
    if (topRecommendations.length === 0) {
      return sectionEmpty('Add bookmarks and we will recommend closely related papers.');
    }

    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {topRecommendations.map((paper, index) => (
          <article
            key={`rec-${paper.arxivId}`}
            className="card p-5"
            style={{ borderColor: index === 0 ? 'hsl(var(--accent-amber) / 0.34)' : undefined }}
          >
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ color: 'hsl(var(--accent-amber))', borderColor: 'hsl(var(--accent-amber) / 0.35)' }}>
                Recommended #{index + 1}
              </span>
              <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-muted))' }}>
                {formatDate(paper.published) || 'Recent'}
              </span>
            </div>

            <h3 className="mb-2 text-[1.24rem] font-black leading-tight tracking-[-0.02em]" style={{ color: 'hsl(var(--text-primary))' }}>
              {paper.title}
            </h3>

            <p className="mb-4 text-[0.98rem] leading-[1.72]" style={{ color: 'hsl(var(--text-secondary))' }}>
              {shortText(paper.summary, 190)}
            </p>

            <div className="mb-3 flex flex-wrap gap-2">
              {paper.categories.slice(0, 3).map((cat) => (
                <span key={`${paper.arxivId}-${cat}`} className="landing-pill">
                  {cat}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <a href={paper.url} target="_blank" rel="noopener noreferrer" className="landing-cta-primary" style={{ textDecoration: 'none', padding: '0.55rem 0.95rem', minHeight: 'unset' }}>
                <ExternalLink className="h-4 w-4" />
                Open paper
              </a>
              <button onClick={() => void toggleBookmark(paper)} className="stat-pill">
                <Bookmark className="h-3.5 w-3.5" />
                {bookmarkIds.has(paper.arxivId) ? 'Bookmarked' : 'Bookmark'}
              </button>
            </div>
          </article>
        ))}
      </div>
    );
  };

  const renderActiveContent = () => {
    if (activeTab === 'recents') return renderRecents();
    if (activeTab === 'bookmarks') return renderBookmarks();
    return renderRecommendations();
  };

  return (
    <main className="workbench-bg noise-overlay min-h-screen">
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-14 pt-4 sm:px-6 lg:px-8 lg:pb-16 lg:pt-6">
        <header className="workbench-topbar mb-4 rounded-2xl px-4 py-3 sm:mb-6 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-blue))' }}>
                Personalized Dashboard
              </p>
              <h1 className="mt-1 text-[clamp(1.44rem,1.02rem+1.06vw,2.1rem)] font-black tracking-[-0.03em]" style={{ color: 'hsl(var(--text-primary))' }}>
                Your Research Workspace
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => void loadDashboard('refresh')}
                disabled={isRefreshing}
                className="stat-pill"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <Link href="/" className="stat-pill">
                <PanelLeftClose className="h-4 w-4" />
                Back to Home
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: '/auth?next=/dashboard' })}
                className="stat-pill"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div
            className="mb-5 rounded-xl border px-4 py-3 text-sm"
            style={{
              borderColor: 'hsl(var(--accent-rose) / 0.3)',
              color: 'hsl(var(--accent-rose))',
              background: 'hsl(var(--accent-rose) / 0.08)',
            }}
          >
            {error}
          </div>
        )}

        <div className="workbench-grid gap-4 lg:gap-6">
          <aside className="workbench-sidebar card workbench-static hidden lg:block">
            <div className="space-y-6 p-4">
              <div>
                <p className="workbench-group-label mb-2">Sections</p>
                <div className="space-y-1.5">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`workbench-nav-btn ${activeTab === tab.id ? 'workbench-nav-btn-active' : ''}`}
                    >
                      <tab.icon className="h-4 w-4" />
                      {tab.label}
                      <span className="ml-auto rounded-full border px-1.5 py-0.5 text-[10px] font-black" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                        {dashboardCounts[tab.id]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="workbench-main">
            <div className="card workbench-static mb-4 overflow-hidden lg:hidden">
              <div className="workbench-mobile-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`workbench-mobile-tab ${activeTab === tab.id ? 'workbench-mobile-tab-active' : ''}`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                    <span className="rounded-full border px-1.5 py-0.5 text-[10px] font-black" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                      {dashboardCounts[tab.id]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="card workbench-static mb-4 p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-[clamp(1.25rem,0.95rem+0.8vw,1.7rem)] font-black tracking-[-0.02em]" style={{ color: 'hsl(var(--text-primary))' }}>
                    {activeTabMeta.label}
                  </h2>
                  <p className="mt-1 text-[0.98rem] font-medium" style={{ color: 'hsl(var(--text-muted))' }}>
                    {activeTabMeta.subtitle}
                  </p>
                </div>
                <span className="stat-pill">
                  {activeCount} item{activeCount === 1 ? '' : 's'}
                </span>
              </div>
              {activeTab === 'recommendations' && (
                <p className="mt-3 text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                  Showing top 4 recommendations to keep this focused and readable.
                </p>
              )}
            </div>

            <div className="card workbench-static workbench-panel p-4 sm:p-5 lg:p-6">
              {renderActiveContent()}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
