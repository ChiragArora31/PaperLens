import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Activity,
  BarChart3,
  BookMarked,
  Download,
  Eye,
  MessageSquareText,
  Repeat2,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { requireAdminSession } from '@/lib/admin';
import { getAnalyticsSummary } from '@/lib/db';

export const dynamic = 'force-dynamic';

function compactNumber(value: number): string {
  return Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function formatEventName(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function MiniBars({ data, metric }: { data: Array<Record<string, string | number>>; metric: string }) {
  const max = Math.max(1, ...data.map((item) => Number(item[metric] ?? 0)));
  return (
    <div className="analytics-bars" aria-label={`${metric} trend`}>
      {data.slice(-30).map((item) => {
        const value = Number(item[metric] ?? 0);
        return (
          <div key={`${item.date ?? item.month}-${metric}`} className="analytics-bar-wrap" title={`${item.date ?? item.month}: ${value}`}>
            <span className="analytics-bar" style={{ height: `${Math.max(6, (value / max) * 100)}%` }} />
          </div>
        );
      })}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const session = await requireAdminSession();
  if (!session) redirect('/auth?next=/admin/analytics');

  const analytics = await getAnalyticsSummary();
  const stats = [
    { label: 'DAU', value: analytics.totals.dailyActiveUsers, icon: Activity, hint: 'active today' },
    { label: 'MAU', value: analytics.totals.monthlyActiveUsers, icon: Users, hint: 'active in 30 days' },
    { label: 'Registered', value: analytics.totals.registeredUsers, icon: ShieldCheck, hint: 'total accounts' },
    { label: 'Anonymous', value: analytics.totals.anonymousVisitors30d, icon: Eye, hint: '30-day visitors' },
    { label: 'Analyses', value: analytics.totals.paperAnalyses30d, icon: Search, hint: `${analytics.totals.paperAnalysesToday} today` },
    { label: 'Repeat Users', value: analytics.totals.repeatUsers30d, icon: Repeat2, hint: '2+ active days' },
    { label: 'Bookmarks', value: analytics.totals.bookmarks30d, icon: BookMarked, hint: '30-day saves' },
    { label: 'Exports', value: analytics.totals.exports30d, icon: Download, hint: 'PDF downloads' },
    { label: 'Chat', value: analytics.totals.chatMessages30d, icon: MessageSquareText, hint: 'paper questions' },
  ];

  return (
    <main className="workbench-bg noise-overlay min-h-screen">
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-14 pt-4 sm:px-6 lg:px-8 lg:pb-16 lg:pt-6">
        <header className="workbench-topbar mb-5 rounded-2xl px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-teal))' }}>
                Admin Analytics
              </p>
              <h1 className="mt-1 text-[clamp(1.5rem,1.02rem+1.24vw,2.2rem)] font-black tracking-[-0.03em]">
                PaperLens Growth Console
              </h1>
            </div>
            <Link href="/dashboard" className="stat-pill">
              Back to dashboard
            </Link>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <article key={stat.label} className="card workbench-static p-5">
              <div className="mb-4 flex items-center justify-between">
                <span className="analytics-icon"><stat.icon className="h-4 w-4" /></span>
                <span className="eyebrow-label" style={{ color: 'hsl(var(--text-muted))' }}>{stat.hint}</span>
              </div>
              <p className="text-sm font-bold" style={{ color: 'hsl(var(--text-muted))' }}>{stat.label}</p>
              <p className="mt-1 text-[2.15rem] font-black leading-none tracking-[-0.03em]">{compactNumber(stat.value)}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
          <article className="card workbench-static p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <span className="analytics-icon"><BarChart3 className="h-4 w-4" /></span>
              <div>
                <h2 className="text-xl font-black tracking-[-0.02em]">Daily Product Pulse</h2>
                <p className="text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                  Activity, analyses, saves, exports, and cited chat over the last 30 days.
                </p>
              </div>
            </div>
            <MiniBars data={analytics.dailySeries} metric="activeUsers" />
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {['analyses', 'bookmarks', 'exports', 'chats'].map((metric) => (
                <div key={metric} className="rounded-xl border p-3" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                  <p className="eyebrow-label mb-2" style={{ color: 'hsl(var(--text-muted))' }}>{metric}</p>
                  <MiniBars data={analytics.dailySeries} metric={metric} />
                </div>
              ))}
            </div>
          </article>

          <article className="card workbench-static p-5 sm:p-6">
            <h2 className="text-xl font-black tracking-[-0.02em]">Retention Signal</h2>
            <p className="mt-1 text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
              Users active this week who were also active in the previous week.
            </p>
            <div className="mt-6 flex items-end gap-3">
              <p className="text-[3rem] font-black leading-none">{analytics.retention.returningRate}%</p>
              <p className="pb-2 text-sm font-bold" style={{ color: 'hsl(var(--text-muted))' }}>
                {analytics.retention.returnedFromPrevious7d} of {analytics.retention.activeLast7d}
              </p>
            </div>
            <div className="mt-6 rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
              <p className="eyebrow-label mb-2" style={{ color: 'hsl(var(--accent-blue))' }}>Usage mix</p>
              <div className="flex flex-wrap gap-2">
                <span className="stat-pill">Logged-in analyses: {analytics.totals.loggedInAnalyses30d}</span>
                <span className="stat-pill">Guest analyses: {analytics.totals.guestAnalyses30d}</span>
              </div>
            </div>
          </article>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-2">
          <article className="card workbench-static p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-black tracking-[-0.02em]">Most Analyzed Papers</h2>
            <div className="space-y-3">
              {analytics.popularPapers.length === 0 ? (
                <p className="text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>No analyzed papers yet.</p>
              ) : analytics.popularPapers.map((paper, index) => (
                <Link key={paper.arxivId} href={`/paper/${paper.arxivId}`} className="analytics-row">
                  <span className="analytics-rank">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-black">{paper.title}</span>
                    <span className="text-xs font-bold" style={{ color: 'hsl(var(--text-muted))' }}>arXiv:{paper.arxivId}</span>
                  </span>
                  <span className="stat-pill">{paper.count}</span>
                </Link>
              ))}
            </div>
          </article>

          <article className="card workbench-static p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-black tracking-[-0.02em]">Traffic Sources</h2>
            <div className="space-y-3">
              {analytics.trafficSources.length === 0 ? (
                <p className="text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>Traffic source data appears after page views.</p>
              ) : analytics.trafficSources.map((source) => (
                <div key={source.source} className="analytics-row">
                  <span className="min-w-0 flex-1 truncate font-black">{source.source}</span>
                  <span className="stat-pill">{source.count}</span>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-5 card workbench-static p-5 sm:p-6">
          <h2 className="mb-4 text-xl font-black tracking-[-0.02em]">Recent Events</h2>
          <div className="grid gap-2">
            {analytics.recentEvents.map((event) => (
              <div key={`${event.eventName}-${event.createdAt}`} className="analytics-row">
                <span className="stat-pill">{event.identity}</span>
                <span className="font-black">{formatEventName(event.eventName)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                  {event.title || event.arxivId || 'PaperLens'}
                </span>
                <span className="hidden text-xs font-bold sm:inline" style={{ color: 'hsl(var(--text-muted))' }}>
                  {new Date(event.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
