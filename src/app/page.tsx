'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain,
  Eye,
  Layers,
  Rocket,
  ArrowRight,
  Sigma,
  Sparkles,
} from 'lucide-react';
import HeroInput from '@/components/HeroInput';
import ThemeToggle from '@/components/ThemeToggle';
import BrandMark from '@/components/BrandMark';
import Dashboard from '@/components/dashboard/Dashboard';
import { PaperAnalysis } from '@/lib/types';

const features = [
  {
    icon: Brain,
    title: 'Layered Explanations',
    desc: 'Start intuitive, then step into implementation and deep technical depth.',
    accent: 'hsl(var(--accent-emerald))',
  },
  {
    icon: Eye,
    title: 'Visual Clarity',
    desc: 'Understand architecture and flow through guaranteed rendered diagrams.',
    accent: 'hsl(var(--accent-blue))',
  },
  {
    icon: Layers,
    title: 'Concept Mastery',
    desc: 'Learn each key idea with intuition, pitfalls, analogies, and quick checks.',
    accent: 'hsl(var(--accent-indigo))',
  },
  {
    icon: Rocket,
    title: 'Research Momentum',
    desc: 'Convert long papers into a clear, structured and actionable learning journey.',
    accent: 'hsl(var(--accent-amber))',
  },
];

const loadingMessages = [
  'Hold on! This may take 30-40 seconds.',
  'Get ready to fall in love with learning.',
  'Decoding dense research into visual clarity...',
  'Crafting concept cards, diagrams, and smart explanations...',
  'Almost there. Your guided paper walkthrough is arriving.',
];

function buildWavePath(row: number, phase: number) {
  const baseY = 58 + row * 26;
  const points: string[] = [];

  for (let x = -160; x <= 1360; x += 120) {
    const y =
      baseY +
      Math.sin(x * 0.012 + row * 0.55 + phase) * (16 + row * 0.45) +
      Math.cos(row * 0.3 + phase) * 5;
    points.push(`${x} ${y.toFixed(2)}`);
  }

  return `M ${points.join(' L ')}`;
}

function buildVerticalPath(col: number, phase: number) {
  const baseX = 94 + col * 70;
  const points: string[] = [];

  for (let y = -40; y <= 480; y += 52) {
    const x =
      baseX +
      Math.sin(y * 0.02 + col * 0.42 + phase) * (26 + col * 0.3) +
      Math.cos(col * 0.2 + phase) * 8;
    points.push(`${x.toFixed(2)} ${y}`);
  }

  return `M ${points.join(' L ')}`;
}

function HeroMesh() {
  const rows = useMemo(() => Array.from({ length: 12 }, (_, i) => i), []);
  const columns = useMemo(() => Array.from({ length: 14 }, (_, i) => i), []);

  return (
    <div className="landing-mesh-wrap" aria-hidden>
      <div className="landing-grid-plane" />
      <div className="landing-light-bloom landing-light-bloom-left" />
      <div className="landing-light-bloom landing-light-bloom-right" />
      <svg className="landing-wave-svg" viewBox="0 0 1200 460" preserveAspectRatio="none">
        {rows.map((row) => {
          const start = buildWavePath(row, 0);
          const alt = buildWavePath(row, Math.PI / 2.5);
          return (
            <motion.path
              key={`h-${row}`}
              d={start}
              stroke="url(#meshHorizontal)"
              strokeWidth={1.08}
              fill="none"
              strokeLinecap="round"
              initial={{ opacity: 0.16 }}
              animate={{ d: [start, alt, start], opacity: [0.16, 0.56, 0.16] }}
              transition={{
                duration: 6.5 + row * 0.34,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: row * 0.05,
              }}
            />
          );
        })}
        {columns.map((col) => {
          const start = buildVerticalPath(col, 0);
          const alt = buildVerticalPath(col, Math.PI / 2.8);
          return (
            <motion.path
              key={`v-${col}`}
              d={start}
              stroke="url(#meshVertical)"
              strokeWidth={0.98}
              fill="none"
              strokeLinecap="round"
              initial={{ opacity: 0.12 }}
              animate={{ d: [start, alt, start], opacity: [0.12, 0.32, 0.12] }}
              transition={{
                duration: 7.6 + col * 0.26,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: col * 0.04,
              }}
            />
          );
        })}
        <defs>
          <linearGradient id="meshHorizontal" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="hsl(var(--accent-teal) / 0.06)" />
            <stop offset="45%" stopColor="hsl(var(--accent-teal) / 0.88)" />
            <stop offset="100%" stopColor="hsl(var(--accent-blue) / 0.58)" />
          </linearGradient>
          <linearGradient id="meshVertical" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--accent-cyan) / 0.04)" />
            <stop offset="52%" stopColor="hsl(var(--accent-blue) / 0.44)" />
            <stop offset="100%" stopColor="hsl(var(--accent-indigo) / 0.16)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

export default function Home() {
  const [analysis, setAnalysis] = useState<PaperAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [error, setError] = useState('');

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
      } else {
        const fallback =
          response.status >= 500
            ? 'Server error while analyzing this paper. Please retry in a few seconds.'
            : 'Could not analyze this arXiv input. Please check the link and try again.';
        setError(result.error || fallback);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Network error while contacting the analysis service.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (analysis) {
    return <Dashboard analysis={analysis} onBack={() => setAnalysis(null)} />;
  }

  return (
    <main className="landing-page min-h-screen noise-overlay">
      <HeroMesh />

      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-18 pt-6 sm:px-8 md:px-10 md:pt-8">
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42 }}
          className="glass landing-topbar mb-12 flex items-center justify-between rounded-2xl px-4 py-3 md:px-5"
        >
          <div className="flex items-center gap-3">
            <div className="brand-mark-wrap">
              <BrandMark size={44} />
            </div>
            <div>
              <p className="brand-wordmark landing-brand-wordmark">
                <span className="brand-wordmark-paper">Paper</span>
                <span className="brand-wordmark-play">Lens</span>
              </p>
              <p className="landing-brand-note hidden sm:block">
                Decoding research into clear, interactive learning.
              </p>
            </div>
          </div>

          <ThemeToggle />
        </motion.nav>

        <section className="relative mb-16 grid gap-10 xl:grid-cols-[0.98fr_1.02fr] xl:items-center">
          <div className="max-w-3xl">
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.36 }}
              className="landing-announcement mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
            >
              <Sigma className="h-4 w-4" />
              Built for deep research learning, not surface-level summaries.
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.58, delay: 0.06 }}
              className="landing-title mb-6"
            >
              Turn any research paper into
              <span className="gradient-text"> visual, engaging understanding.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.14 }}
              className="landing-lead max-w-3xl"
            >
              PaperLens transforms dense research into layered explanations, concept cards,
              guaranteed diagrams, and guided study flow so learning feels clear, energizing, and
              memorable.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <a href="#paper-input" className="landing-cta-primary">
                Start with an arXiv paper
                <ArrowRight className="h-4 w-4" />
              </a>
              <span className="landing-inline-note">No PDF uploads, no setup. Paste link and learn.</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.24 }}
              className="mt-8 flex flex-wrap gap-2.5"
            >
              {['3 explanation layers', '4 visual diagrams', 'concept cards + TL;DR', 'arXiv-only focus'].map(
                (pill) => (
                  <span key={pill} className="landing-pill">
                    {pill}
                  </span>
                ),
              )}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            id="paper-input"
            className="landing-input-panel landing-action-panel card p-6 sm:p-7 md:p-8"
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
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-5 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: `hsl(${['var(--accent-indigo)', 'var(--accent-blue)', 'var(--accent-cyan)'][i]})`,
                      }}
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
                    className="text-xs font-semibold sm:text-sm"
                    style={{ color: 'hsl(var(--text-muted))' }}
                  >
                    {loadingMessages[loadingMessageIndex]}
                  </motion.p>
                </AnimatePresence>
              </motion.div>
            )}

            <div className="mt-6 grid gap-2.5 sm:grid-cols-2">
              <div className="landing-mini-tile">
                <Sparkles className="h-4 w-4" />
                Visual-first explanation flow
              </div>
              <div className="landing-mini-tile">
                <Brain className="h-4 w-4" />
                Intuition to deep technical
              </div>
              <div className="landing-mini-tile">
                <Layers className="h-4 w-4" />
                Concept cards and memory hooks
              </div>
              <div className="landing-mini-tile">
                <Rocket className="h-4 w-4" />
                Built for repeat learning sessions
              </div>
            </div>
          </motion.div>
        </section>

        <section>
          <div className="mb-5 flex items-center gap-2">
            <ArrowRight className="h-4 w-4" style={{ color: 'hsl(var(--accent-teal))' }} />
            <h2 className="landing-section-label">
              Why this feels different
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.24 + i * 0.08 }}
                className="feature-card landing-feature-card"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: `${feature.accent}20` }}>
                  <feature.icon className="h-5 w-5" style={{ color: feature.accent }} />
                </div>
                <h3 className="landing-feature-title mb-2" style={{ color: 'hsl(var(--text-primary))' }}>
                  {feature.title}
                </h3>
                <p className="landing-feature-copy" style={{ color: 'hsl(var(--text-secondary))' }}>
                  {feature.desc}
                </p>
              </motion.div>
            ))}
          </div>
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
