import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, BookOpenCheck, ExternalLink, Layers, MessageSquareText, Share2 } from 'lucide-react';
import BrandMark from '@/components/BrandMark';
import PublicShareButton from '@/components/PublicShareButton';
import { getPublicPaper } from '@/lib/db';
import type { PaperAnalysis } from '@/lib/types';

interface PageProps {
  params: Promise<{ arxivId: string }>;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asAnalysis(value: unknown): PaperAnalysis | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PaperAnalysis>;
  if (!candidate.metadata?.title || !candidate.tldr?.summary) return null;
  return candidate as PaperAnalysis;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { arxivId } = await params;
  const paper = await getPublicPaper(decodeURIComponent(arxivId));
  if (!paper) return { title: 'Paper Breakdown Not Found' };

  const description = text((paper.analysis as Partial<PaperAnalysis>)?.tldr?.summary) || paper.abstract;
  return {
    title: `${paper.title} | PaperLens Breakdown`,
    description: description.slice(0, 180),
    alternates: { canonical: `/paper/${paper.arxivId}` },
    openGraph: {
      title: `${paper.title} | PaperLens Breakdown`,
      description: description.slice(0, 180),
      url: `/paper/${paper.arxivId}`,
      type: 'article',
      siteName: 'PaperLens',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${paper.title} | PaperLens`,
      description: description.slice(0, 180),
    },
  };
}

export default async function PublicPaperPage({ params }: PageProps) {
  const { arxivId } = await params;
  const paper = await getPublicPaper(decodeURIComponent(arxivId));
  const analysis = asAnalysis(paper?.analysis);
  if (!paper || !analysis) notFound();

  const shareText = `${analysis.metadata.title}\n\n${analysis.tldr.summary}\n\nRead the PaperLens breakdown: https://paperlens.in/paper/${analysis.metadata.id}`;

  return (
    <main className="workbench-bg noise-overlay min-h-screen">
      <div className="relative z-10 mx-auto max-w-[1160px] px-4 pb-14 pt-4 sm:px-6 lg:px-8 lg:pb-16 lg:pt-6">
        <header className="workbench-topbar mb-5 rounded-2xl px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-3 text-inherit no-underline">
              <BrandMark size={34} />
              <div>
                <p className="brand-wordmark">PaperLens</p>
                <p className="hidden text-xs font-bold sm:block" style={{ color: 'hsl(var(--text-muted))' }}>
                  Public paper breakdown
                </p>
              </div>
            </Link>
            <div className="flex flex-wrap gap-2">
              <a href={`https://arxiv.org/abs/${analysis.metadata.id}`} target="_blank" rel="noopener noreferrer" className="stat-pill">
                <ExternalLink className="h-3.5 w-3.5" />
                arXiv
              </a>
              <Link href={`/?paper=${encodeURIComponent(analysis.metadata.id)}`} className="landing-cta-primary">
                Decode another
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <section className="card workbench-static p-5 sm:p-7 lg:p-9">
          <div className="mb-4 flex flex-wrap gap-2">
            <span className="landing-pill">arXiv:{analysis.metadata.id}</span>
            <span className="landing-pill">{paper.analyzedCount} PaperLens breakdown{paper.analyzedCount === 1 ? '' : 's'}</span>
            {analysis.metadata.categories.slice(0, 3).map((category) => (
              <span key={category} className="landing-pill">{category}</span>
            ))}
          </div>
          <h1 className="text-[clamp(2rem,1.25rem+3vw,4.4rem)] font-black leading-[1.02] tracking-[-0.04em]">
            {analysis.metadata.title}
          </h1>
          <p className="mt-5 max-w-4xl text-[1.08rem] font-semibold leading-8" style={{ color: 'hsl(var(--text-secondary))' }}>
            {analysis.tldr.summary}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <PublicShareButton text={shareText} />
            <Link href="/" className="stat-pill">
              <Share2 className="h-3.5 w-3.5" />
              Built with PaperLens
            </Link>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
          <article className="card workbench-static p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <BookOpenCheck className="h-5 w-5" style={{ color: 'hsl(var(--accent-teal))' }} />
              <h2 className="text-2xl font-black tracking-[-0.02em]">Key Takeaways</h2>
            </div>
            <div className="space-y-3">
              {analysis.tldr.keyTakeaways.slice(0, 6).map((takeaway, index) => (
                <div key={`${takeaway}-${index}`} className="rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                  <p className="font-semibold leading-7" style={{ color: 'hsl(var(--text-secondary))' }}>{takeaway}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="card workbench-static p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <Layers className="h-5 w-5" style={{ color: 'hsl(var(--accent-blue))' }} />
              <h2 className="text-2xl font-black tracking-[-0.02em]">Core Concepts</h2>
            </div>
            <div className="space-y-3">
              {analysis.concepts.slice(0, 4).map((concept) => (
                <div key={concept.name} className="rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                  <h3 className="font-black">{concept.name}</h3>
                  <p className="mt-1 text-sm font-semibold leading-6" style={{ color: 'hsl(var(--text-muted))' }}>{concept.takeaway || concept.intuition}</p>
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="mt-5 card workbench-static p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <MessageSquareText className="h-5 w-5" style={{ color: 'hsl(var(--accent-indigo))' }} />
            <h2 className="text-2xl font-black tracking-[-0.02em]">Why It Matters</h2>
          </div>
          <p className="reading-lead">{analysis.whyCare.realWorldImpact || analysis.tldr.whyItMatters}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {analysis.whyCare.useCases.slice(0, 5).map((item) => (
              <span key={item} className="landing-pill">{item}</span>
            ))}
          </div>
        </section>

        <footer className="landing-footer">
          <p>
            Built with <Link href="/" className="landing-footer-link">PaperLens</Link>, a clean AI companion for understanding arXiv papers.
          </p>
        </footer>
      </div>
    </main>
  );
}
