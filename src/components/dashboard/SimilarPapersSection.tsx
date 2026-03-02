'use client';

import { motion } from 'framer-motion';
import { ArrowUpRight, Calendar, Sparkles, Tags } from 'lucide-react';
import type { SimilarPaper } from '@/lib/types';

interface SimilarPapersSectionProps {
  papers: SimilarPaper[];
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Recent';
  return parsed.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function compactText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function shorten(value: string, max = 210): string {
  const clean = compactText(value);
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const stop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '), slice.lastIndexOf(', '), slice.lastIndexOf(' '));
  const cut = stop > max * 0.62 ? stop : max;
  return `${slice.slice(0, cut).trim()}...`;
}

function firstSentence(value: string): string {
  const clean = compactText(value);
  if (!clean) return '';
  const sentence = clean.split(/(?<=[.!?])\s+/)[0] ?? clean;
  return shorten(sentence, 140);
}

export default function SimilarPapersSection({ papers }: SimilarPapersSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-cyan)/0.16)]">
          <Sparkles className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-cyan))' }} />
        </div>
        <div>
          <h2 className="section-title">Similar Papers</h2>
          <p className="section-subtitle">Top related reads to continue your learning thread</p>
        </div>
      </div>

      {papers.length === 0 ? (
        <div className="card p-5 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
          No strong similar papers found right now.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {papers.map((paper, index) => {
            const isFeatured = index === 0 && papers.length > 1;
            const title = compactText(paper.title);
            const synopsis = shorten(paper.summary, isFeatured ? 260 : 200);
            const whyMatch = firstSentence(paper.summary) || 'Strong conceptual overlap with the current paper.';
            const scoreLabel =
              typeof paper.similarityScore === 'number' ? `${Math.round(paper.similarityScore * 100)}% match` : 'Related direction';

            return (
              <article
                key={paper.arxivId}
                className={`card p-5 ${isFeatured ? 'xl:col-span-2' : ''}`}
                style={{ borderColor: isFeatured ? 'hsl(var(--accent-cyan) / 0.34)' : undefined }}
              >
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ color: 'hsl(var(--accent-cyan))', borderColor: 'hsl(var(--accent-cyan) / 0.35)' }}>
                    Similar #{index + 1}
                  </span>
                  <span className="eyebrow-label rounded-full border px-2.5 py-1" style={{ color: 'hsl(var(--text-secondary))', borderColor: 'hsl(var(--border-subtle))' }}>
                    {scoreLabel}
                  </span>
                </div>

                <h3 className="mb-2 text-[1.22rem] font-black leading-tight tracking-[-0.02em]" style={{ color: 'hsl(var(--text-primary))' }}>
                  {title}
                </h3>

                <p className="reading-small mb-4" style={{ color: 'hsl(var(--text-secondary))' }}>
                  {synopsis}
                </p>

                <div
                  className="mb-4 rounded-xl border px-3 py-2.5"
                  style={{ borderColor: 'hsl(var(--accent-indigo) / 0.24)', background: 'hsl(var(--accent-indigo) / 0.08)' }}
                >
                  <p className="mb-1 text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: 'hsl(var(--accent-indigo))' }}>
                    Why it matches
                  </p>
                  <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>
                    {whyMatch}
                  </p>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  {paper.categories.slice(0, 3).map((cat) => (
                    <span key={`${paper.arxivId}-${cat}`} className="landing-pill inline-flex items-center gap-1.5">
                      <Tags className="h-3 w-3" />
                      {cat}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="stat-pill">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(paper.published)}
                  </span>

                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="landing-cta-primary"
                    style={{ textDecoration: 'none', padding: '0.56rem 0.95rem', minHeight: 'unset' }}
                  >
                    Open paper
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
