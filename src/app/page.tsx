'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  Compass,
  Layers,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import HeroInput from '@/components/HeroInput';
import ThemeToggle from '@/components/ThemeToggle';
import BrandMark from '@/components/BrandMark';
import Dashboard from '@/components/dashboard/Dashboard';
import type { PaperAnalysis } from '@/lib/types';

const loadingMessages = [
  'Hold on. This may take 30-40 seconds.',
  'Parsing the full paper and building your learning map.',
  'Designing visual diagrams and concept cards.',
  'Preparing cited explanations and practical takeaways.',
  'Almost ready. Your PaperLens workspace is loading.',
];

const pillars = [
  {
    icon: Brain,
    title: 'Layered Intelligence',
    desc: 'Three explanation depths, from intuitive framing to deep technical detail.',
  },
  {
    icon: Layers,
    title: 'Concept-First Learning',
    desc: 'Concept cards with pitfalls, analogies, mini-quiz, and retention hooks.',
  },
  {
    icon: Compass,
    title: 'Research Navigation',
    desc: 'Chat with paper, similar papers, and practical next-study direction.',
  },
  {
    icon: BookOpenCheck,
    title: 'Study-Ready Output',
    desc: 'Exportable summary PDF, structured learning path, and guided flow.',
  },
];

export default function Home() {
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [error, setError] = useState('');
  const { data: session, status: sessionStatus } = useSession();

  useEffect(() => {
    if (!isLoading) {
      setLoadingMessageIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, [isLoading]);

  const handleAnalyze = async (data: { arxivId: string }) => {
    if (isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const raw = await response.text();
      let result: { success?: boolean; data?: PaperAnalysis; error?: string } = {};

      try {
        result = raw ? (JSON.parse(raw) as typeof result) : {};
      } catch {
        result = {};
      }

      if (response.ok && result.success && result.data) {
        setAnalysis(result.data);

        if (session?.user?.id) {
          void fetch('/api/user/recent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              arxivId: result.data.metadata.id,
              title: result.data.metadata.title,
              abstract: result.data.metadata.abstract,
              authors: result.data.metadata.authors,
              categories: result.data.metadata.categories,
            }),
          });
        }
      } else {
        const fallback =
          response.status >= 500
            ? 'Server error while analyzing this paper. Please retry in a few seconds.'
            : 'Could not analyze this arXiv input. Please check the link and try again.';
        setError(result.error || fallback);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Network error while contacting the analysis service.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (analysis) {
    return <Dashboard analysis={analysis} onBack={() => setAnalysis(null)} />;
  }

  return (
    <main className="landing-pro-page noise-overlay min-h-screen">
      <div className="landing-pro-grid" aria-hidden />

      <div className="relative z-10 mx-auto max-w-[1340px] px-4 pb-14 pt-4 sm:px-6 lg:px-8 lg:pb-20 lg:pt-6">
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="landing-pro-nav mb-8 flex items-center justify-between rounded-2xl px-4 py-3 sm:mb-10 sm:px-5"
        >
          <div className="flex items-center gap-3">
            <BrandMark size={42} />
            <div>
              <p className="brand-wordmark landing-brand-wordmark">
                <span className="brand-wordmark-paper">Paper</span>
                <span className="brand-wordmark-play">Lens</span>
              </p>
              <p className="landing-brand-note hidden sm:block">Research understanding, engineered for clarity.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={sessionStatus === 'authenticated' ? '/dashboard' : '/auth'}
              className="landing-pro-nav-btn"
            >
              {sessionStatus === 'authenticated' ? 'My Dashboard' : 'Login / Sign up'}
            </Link>
            <ThemeToggle />
          </div>
        </motion.nav>

        <section className="landing-pro-hero mb-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="landing-pro-badge"
            >
              <Lightbulb className="h-4 w-4" />
              Built for serious research learners, not generic summaries.
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="landing-pro-title"
            >
              Understand any research paper in one clean, visual flow.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="landing-pro-lead"
            >
              PaperLens transforms dense papers into high-signal explanations, rendered diagrams,
              concept cards, cited answers, and study-ready outputs.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.14 }}
              className="flex flex-wrap items-center gap-3"
            >
              <a href="#paper-input" className="landing-cta-primary">
                Start with an arXiv paper
                <ArrowRight className="h-4 w-4" />
              </a>
              <span className="landing-inline-note">No uploads. No setup. Paste and decode.</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="flex flex-wrap gap-2"
            >
              {['3 explanation layers', '4 visual diagrams', 'chat with citations', 'summary PDF export'].map(
                (pill) => (
                  <span key={pill} className="landing-pill">
                    {pill}
                  </span>
                )
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            id="paper-input"
            className="landing-pro-input card workbench-static p-6 sm:p-7"
          >
            <p className="mb-4 text-xs font-extrabold uppercase tracking-[0.12em] text-[hsl(var(--text-muted))] sm:text-sm">
              Start with any arXiv paper
            </p>

            <HeroInput onAnalyze={handleAnalyze} isLoading={isLoading} />

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  className="mt-4 rounded-xl border px-4 py-3 text-sm"
                  style={{
                    borderColor: 'hsl(var(--accent-rose) / 0.28)',
                    color: 'hsl(var(--accent-rose))',
                    background: 'hsl(var(--accent-rose) / 0.08)',
                  }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {isLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-xl border p-3" style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-secondary) / 0.6)' }}>
                <div className="mb-2 flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: 'hsl(var(--accent-blue))' }}
                      animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.14 }}
                    />
                  ))}
                </div>
                <AnimatePresence mode="wait">
                  <motion.p
                    key={loadingMessageIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.22 }}
                    className="text-sm font-semibold"
                    style={{ color: 'hsl(var(--text-muted))' }}
                  >
                    {loadingMessages[loadingMessageIndex]}
                  </motion.p>
                </AnimatePresence>
              </motion.div>
            )}

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <div className="landing-mini-tile">
                <Sparkles className="h-4 w-4" />
                Instant TL;DR + summaries
              </div>
              <div className="landing-mini-tile">
                <Brain className="h-4 w-4" />
                Intuition to deep technical
              </div>
              <div className="landing-mini-tile">
                <Layers className="h-4 w-4" />
                Concept cards + memory hooks
              </div>
              <div className="landing-mini-tile">
                <Compass className="h-4 w-4" />
                Chat and similar paper discovery
              </div>
            </div>
          </motion.div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pillars.map((pillar, index) => (
            <motion.article
              key={pillar.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.24 + index * 0.05 }}
              className="landing-pro-card"
            >
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent-blue)/0.16)]">
                <pillar.icon className="h-5 w-5" style={{ color: 'hsl(var(--accent-blue))' }} />
              </div>
              <h3 className="landing-feature-title mb-2">{pillar.title}</h3>
              <p className="landing-feature-copy">{pillar.desc}</p>
            </motion.article>
          ))}
        </section>

        <footer className="landing-footer">
          <p>
            Built by{' '}
            <a
              href="https://x.com/iChiragArora"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-link"
            >
              ChiragArora
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
