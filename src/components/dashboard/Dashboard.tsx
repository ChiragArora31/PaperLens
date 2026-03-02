'use client';

import { useEffect, useMemo, useState, type ComponentType, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowLeft,
  Sparkles,
  ScrollText,
  Brain,
  Eye,
  Layers,
  Route,
  FileText,
  ExternalLink,
  Calendar,
  Users,
  BookmarkPlus,
  BookmarkCheck,
  MessageSquareText,
  Mic,
  Orbit,
  Target,
  ShieldCheck,
  Code2,
  LayoutDashboard,
} from 'lucide-react';
import { PaperAnalysis } from '@/lib/types';
import ThemeToggle from '@/components/ThemeToggle';
import BrandMark from '@/components/BrandMark';
import TldrSection from './TldrSection';
import ExplanationTabs from './ExplanationTabs';
import MermaidDiagram from './MermaidDiagram';
import ConceptExplorer from './ConceptExplorer';
import PaperBreakdown from './PaperBreakdown';
import WhyCareSection from './WhyCareSection';
import SummarySuiteSection from './SummarySuiteSection';
import LearningPathSection from './LearningPathSection';
import InfographicDiagrams from './InfographicDiagrams';
import SimilarPapersSection from './SimilarPapersSection';
import ChatWithPaperSection from './ChatWithPaperSection';
import PodcastStudioSection from './PodcastStudioSection';
import ExportSummaryButton from './ExportSummaryButton';
import ReliabilitySection from './ReliabilitySection';
import ImplementationPlaybookSection from './ImplementationPlaybookSection';

interface DashboardProps {
  analysis: PaperAnalysis;
  onBack: () => void;
}

type SectionId =
  | 'tldr'
  | 'summary-suite'
  | 'explanations'
  | 'diagrams'
  | 'concepts'
  | 'path'
  | 'implementation'
  | 'reliability'
  | 'breakdown'
  | 'impact'
  | 'similar'
  | 'chat'
  | 'podcast';

const sectionGroups: Array<{
  group: string;
  items: Array<{ id: SectionId; label: string; icon: ComponentType<{ className?: string }> }>;
}> = [
  {
    group: 'Core Learning',
    items: [
      { id: 'tldr', label: 'TL;DR', icon: Sparkles },
      { id: 'summary-suite', label: 'Summary Suite', icon: ScrollText },
      { id: 'explanations', label: 'Explanations', icon: Brain },
      { id: 'diagrams', label: 'Visual Diagrams', icon: Eye },
      { id: 'concepts', label: 'Concept Cards', icon: Layers },
      { id: 'path', label: 'Learning Path', icon: Route },
    ],
  },
  {
    group: 'Build + Trust',
    items: [
      { id: 'implementation', label: 'Implementation', icon: Code2 },
      { id: 'reliability', label: 'Reliability', icon: ShieldCheck },
    ],
  },
  {
    group: 'Research Utility',
    items: [
      { id: 'breakdown', label: 'Section Breakdown', icon: FileText },
      { id: 'impact', label: 'Why It Matters', icon: Target },
      { id: 'similar', label: 'Similar Papers', icon: Orbit },
      { id: 'chat', label: 'Chat with Paper', icon: MessageSquareText },
      { id: 'podcast', label: 'Podcast Studio', icon: Mic },
    ],
  },
];

const sectionDescriptions: Record<SectionId, string> = {
  tldr: 'Get fast context and key takeaways before you dive deeper.',
  'summary-suite': 'Choose 30-second, 1-minute, or 5-minute understanding modes.',
  explanations: 'Switch levels from intuition to deep technical precision.',
  diagrams: 'Study flowcharts and intuition-driven visual blocks side by side.',
  concepts: 'Master core concepts with prerequisites, pitfalls, and memory hooks.',
  path: 'Follow a practical, time-boxed learning strategy.',
  implementation: 'Translate paper insights into a practical build plan and eval strategy.',
  reliability: 'Inspect extraction source, evidence coverage, and analysis confidence.',
  breakdown: 'Read structured rewrites for major paper sections.',
  impact: 'See use cases, industry relevance, and strategic significance.',
  similar: 'Discover top adjacent papers to continue your learning thread.',
  chat: 'Ask questions and get cited answers grounded in the paper.',
  podcast: 'Generate and play an audio-style walkthrough script.',
};

export default function Dashboard({ analysis, onBack }: DashboardProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('tldr');
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [bookmarkLoading, setBookmarkLoading] = useState(false);
  const [bookmarkError, setBookmarkError] = useState('');
  const { data: session, status: sessionStatus } = useSession();

  const meta = analysis.metadata;
  const mermaidDiagrams = analysis.diagrams.slice(0, 2);
  const reliabilityTone =
    analysis.reliability.level === 'High'
      ? 'var(--accent-emerald)'
      : analysis.reliability.level === 'Medium'
        ? 'var(--accent-amber)'
        : 'var(--accent-rose)';
  const reliabilityColor = `hsl(${reliabilityTone})`;

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId || !meta.id) {
      setIsBookmarked(false);
      return;
    }

    const loadBookmarkState = async () => {
      try {
        const response = await fetch(`/api/user/bookmarks?arxivId=${encodeURIComponent(meta.id)}`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const result = (await response.json()) as {
          success?: boolean;
          data?: { isBookmarked?: boolean };
        };
        if (result.success) setIsBookmarked(Boolean(result.data?.isBookmarked));
      } catch {
        // Ignore bookmark status errors in UI.
      }
    };

    void loadBookmarkState();
  }, [session?.user?.id, meta.id]);

  const toggleBookmark = async () => {
    if (!meta.id || bookmarkLoading) return;
    if (!session?.user?.id) {
      setBookmarkError('Please login to bookmark this paper.');
      return;
    }

    setBookmarkError('');
    setBookmarkLoading(true);
    try {
      if (isBookmarked) {
        const response = await fetch(`/api/user/bookmarks?arxivId=${encodeURIComponent(meta.id)}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setIsBookmarked(false);
          return;
        }

        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setBookmarkError(payload?.error || 'Could not remove bookmark. Please retry.');
        return;
      }

      const response = await fetch('/api/user/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arxivId: meta.id,
          title: meta.title,
          abstract: meta.abstract,
          authors: meta.authors,
          categories: meta.categories,
        }),
      });

      if (response.ok) {
        setIsBookmarked(true);
        return;
      }

      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setBookmarkError(payload?.error || 'Could not save bookmark. Please retry.');
    } catch {
      setBookmarkError('Could not update bookmark right now. Please retry.');
    } finally {
      setBookmarkLoading(false);
    }
  };

  const publishedDate = useMemo(() => {
    if (!meta.published) return '';
    const parsed = new Date(meta.published);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  }, [meta.published]);

  const renderSection = () => {
    switch (activeSection) {
      case 'tldr':
        return <TldrSection data={analysis.tldr} evidence={analysis.evidence} />;
      case 'summary-suite':
        return <SummarySuiteSection data={analysis.summarySuite} />;
      case 'explanations':
        return <ExplanationTabs data={analysis.explanations} evidence={analysis.evidence.explanations} />;
      case 'diagrams':
        return (
          <div className="space-y-8">
            <SectionHeader
              icon={Eye}
              title="Visual Diagrams"
              subtitle="2 flowcharts + 2 intuition infographics for deep understanding"
              color="212 92% 54%"
            />
            <div>
              <p className="eyebrow-label mb-3" style={{ color: 'hsl(var(--accent-blue))' }}>
                Flowcharts
              </p>
              <div className="grid gap-6 xl:grid-cols-2">
                {mermaidDiagrams.map((diagram, i) => (
                  <MermaidDiagram key={i} diagram={diagram} />
                ))}
              </div>
            </div>
            <div>
              <p className="eyebrow-label mb-3" style={{ color: 'hsl(var(--accent-indigo))' }}>
                Intuition Infographics
              </p>
              <InfographicDiagrams analysis={analysis} />
            </div>
          </div>
        );
      case 'concepts':
        return <ConceptExplorer concepts={analysis.concepts} />;
      case 'path':
        return <LearningPathSection data={analysis.learningPath} />;
      case 'implementation':
        return <ImplementationPlaybookSection data={analysis.implementationPlaybook} />;
      case 'reliability':
        return <ReliabilitySection reliability={analysis.reliability} />;
      case 'breakdown':
        return <PaperBreakdown sections={analysis.sections} />;
      case 'impact':
        return <WhyCareSection data={analysis.whyCare} />;
      case 'similar':
        return <SimilarPapersSection papers={analysis.similarPapers ?? []} />;
      case 'chat':
        return <ChatWithPaperSection arxivId={analysis.metadata.id} />;
      case 'podcast':
        return <PodcastStudioSection analysis={analysis} />;
      default:
        return <TldrSection data={analysis.tldr} evidence={analysis.evidence} />;
    }
  };

  return (
    <div className="min-h-screen workbench-bg noise-overlay">
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pb-16 lg:pt-6">
        <header className="workbench-topbar mb-4 rounded-2xl px-4 py-3 sm:mb-6 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--text-secondary))' }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="hidden items-center gap-2.5 sm:flex">
                <BrandMark size={30} />
                <span className="brand-wordmark" style={{ fontSize: '1.1rem' }}>
                  PaperLens
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {sessionStatus === 'authenticated' && (
                <Link href="/dashboard" className="stat-pill" style={{ textDecoration: 'none' }}>
                  <LayoutDashboard className="h-3.5 w-3.5" />
                  Dashboard
                </Link>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="workbench-grid gap-4 lg:gap-6">
          <aside className="workbench-sidebar card workbench-static hidden lg:block">
            <div className="space-y-6 p-4">
              {sectionGroups.map((group) => (
                <div key={group.group}>
                  <p className="workbench-group-label mb-2">{group.group}</p>
                  <div className="space-y-1.5">
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        className={`workbench-nav-btn ${activeSection === item.id ? 'workbench-nav-btn-active' : ''}`}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="workbench-main">
            <div className="card workbench-static mb-4 p-5 sm:mb-5 sm:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <h1
                    className="mb-2 text-[clamp(1.56rem,1.2rem+1.4vw,2.5rem)] font-extrabold leading-[1.05] tracking-[-0.03em]"
                    style={{ color: 'hsl(var(--text-primary))' }}
                  >
                    {meta.title}
                  </h1>
                  <p className="text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
                    {sectionDescriptions[activeSection]}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {meta.id && (
                    <a
                      href={`https://arxiv.org/abs/${meta.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="stat-pill"
                      style={{ textDecoration: 'none' }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      arXiv:{meta.id}
                    </a>
                  )}
                  <ExportSummaryButton analysis={analysis} />
                  {sessionStatus === 'authenticated' && meta.id && (
                    <button onClick={toggleBookmark} disabled={bookmarkLoading} className="stat-pill">
                      {isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
                      {isBookmarked ? 'Bookmarked' : 'Bookmark'}
                    </button>
                  )}
                  {sessionStatus === 'unauthenticated' && (
                    <Link href="/auth" className="stat-pill">
                      <BookmarkPlus className="h-3.5 w-3.5" />
                      Login to bookmark
                    </Link>
                  )}
                </div>
              </div>

              {bookmarkError && (
                <p
                  className="mt-3 text-sm font-medium"
                  style={{ color: 'hsl(var(--accent-rose))' }}
                >
                  {bookmarkError}
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                {meta.authors.length > 0 && (
                  <span className="stat-pill">
                    <Users className="h-3.5 w-3.5" />
                    {meta.authors.slice(0, 3).join(', ')}
                    {meta.authors.length > 3 && ` +${meta.authors.length - 3}`}
                  </span>
                )}
                {publishedDate && (
                  <span className="stat-pill">
                    <Calendar className="h-3.5 w-3.5" />
                    {publishedDate}
                  </span>
                )}
                <span
                  className="stat-pill"
                  style={{
                    borderColor: `hsl(${reliabilityTone} / 0.32)`,
                    color: reliabilityColor,
                    background: `hsl(${reliabilityTone} / 0.12)`,

                  }}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Reliability {analysis.reliability.score}
                </span>
              </div>
            </div>

            <div className="card workbench-static mb-4 overflow-hidden lg:hidden">
              <div className="workbench-mobile-tabs">
                {sectionGroups.flatMap((group) => group.items).map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`workbench-mobile-tab ${activeSection === item.id ? 'workbench-mobile-tab-active' : ''}`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="card workbench-static workbench-panel p-4 sm:p-5 lg:p-6">{renderSection()}</div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  color,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `hsl(${color} / 0.14)` }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: `hsl(${color})` }} />
      </div>
      <div>
        <h2 className="section-title" style={{ color: 'hsl(var(--text-primary))' }}>
          {title}
        </h2>
        <p className="section-subtitle" style={{ color: 'hsl(var(--text-muted))' }}>
          {subtitle}
        </p>
      </div>
    </div>
  );
}
