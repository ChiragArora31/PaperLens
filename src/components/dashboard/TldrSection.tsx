'use client';

import { motion } from 'framer-motion';
import { Sparkles, Star, BarChart3, Lightbulb } from 'lucide-react';
import type { AnalysisEvidence, TldrData } from '@/lib/types';
import { RichParagraph } from './RichText';
import ClaimEvidencePanel from './ClaimEvidencePanel';

interface TldrSectionProps {
  data: TldrData;
  evidence?: AnalysisEvidence;
}

const difficultyConfig: Record<string, { label: string; class: string }> = {
  beginner: { label: 'Beginner', class: 'badge-beginner' },
  intermediate: { label: 'Intermediate', class: 'badge-intermediate' },
  advanced: { label: 'Advanced', class: 'badge-advanced' },
};

export default function TldrSection({ data, evidence }: TldrSectionProps) {
  const diff = difficultyConfig[data.difficulty.toLowerCase()] || difficultyConfig.intermediate;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-indigo)/0.14)]">
            <Sparkles className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-indigo))' }} />
          </div>
          <div>
            <h2 className="section-title">TL;DR</h2>
            <p className="section-subtitle">Quick understanding before details</p>
          </div>
        </div>

        <span className={`badge ${diff.class}`}>
          <BarChart3 className="h-3.5 w-3.5" />
          {diff.label}
        </span>
      </div>

      <div className="card mb-5 p-6 md:p-7" style={{ borderLeft: '4px solid hsl(var(--accent-indigo) / 0.4)' }}>
        {data.hook && <p className="emphasis-kicker mb-3">{data.hook}</p>}
        <RichParagraph text={data.summary} className="reading-lead" />
        <ClaimEvidencePanel title="Show evidence for summary" citations={evidence?.tldrSummary ?? []} />
      </div>

      <div className="mb-5">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-extrabold tracking-[-0.016em]" style={{ color: 'hsl(var(--text-secondary))' }}>
          <Star className="h-4 w-4" style={{ color: 'hsl(var(--accent-amber))' }} />
          Key takeaways
        </h3>

        <div className="space-y-3">
          {data.keyTakeaways.map((takeaway, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              className="flex items-start gap-3"
            >
              <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent-indigo)/0.12)] text-xs font-bold" style={{ color: 'hsl(var(--accent-indigo))' }}>
                {i + 1}
              </div>
              <div className="flex-1">
                <RichParagraph text={takeaway} className="reading-body" />
                <ClaimEvidencePanel
                  title="Show evidence"
                  citations={evidence?.tldrTakeaways.find((item) => item.claim === takeaway)?.citations ?? []}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {data.whyItMatters && (
        <div className="reading-card rounded-2xl border p-5" style={{ borderColor: 'hsl(var(--accent-emerald) / 0.24)', background: 'hsl(var(--accent-emerald) / 0.07)' }}>
          <div className="mb-2 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" style={{ color: 'hsl(var(--accent-emerald))' }} />
            <span className="eyebrow-label" style={{ color: 'hsl(var(--accent-emerald))' }}>
              Why this matters
            </span>
          </div>
          <RichParagraph text={data.whyItMatters} className="reading-body" />
          <ClaimEvidencePanel title="Show evidence for impact" citations={evidence?.tldrWhyItMatters ?? []} />
        </div>
      )}
    </motion.section>
  );
}
