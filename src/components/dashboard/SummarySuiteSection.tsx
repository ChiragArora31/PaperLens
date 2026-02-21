'use client';

import { motion } from 'framer-motion';
import { Timer, ListChecks, CircleHelp, NotebookPen } from 'lucide-react';
import { SummarySuite } from '@/lib/types';
import { RichParagraph } from './RichText';

interface SummarySuiteSectionProps {
  data: SummarySuite;
}

const summaryCards = [
  { key: 'ultraShort' as const, title: '30 Seconds', subtitle: 'Fast mental model' },
  { key: 'oneMinute' as const, title: '1 Minute', subtitle: 'Core narrative' },
  { key: 'fiveMinute' as const, title: '5 Minutes', subtitle: 'Complete walkthrough' },
];

export default function SummarySuiteSection({ data }: SummarySuiteSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-teal)/0.16)]">
          <Timer className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-teal))' }} />
        </div>
        <div>
          <h2 className="section-title">Summary Suite</h2>
          <p className="section-subtitle">
            Different summary lengths for different moments
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summaryCards.map((card, index) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.28, delay: index * 0.05 }}
            className="card p-5"
          >
            <p className="eyebrow-label" style={{ color: 'hsl(var(--accent-teal))' }}>
              {card.title}
            </p>
            <p className="mb-2 text-sm font-semibold tracking-[-0.01em]" style={{ color: 'hsl(var(--text-muted))' }}>
              {card.subtitle}
            </p>
            <RichParagraph text={data[card.key]} className="reading-body" />
          </motion.div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="card reading-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <CircleHelp className="h-4 w-4" style={{ color: 'hsl(var(--accent-blue))' }} />
            <h3 className="text-base font-extrabold tracking-[-0.014em]">Revision Questions</h3>
          </div>
          <div className="space-y-2">
            {data.revisionQuestions.map((question, index) => (
              <RichParagraph key={index} text={`${index + 1}. ${question}`} className="reading-small" />
            ))}
          </div>
        </div>

        <div className="card reading-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks className="h-4 w-4" style={{ color: 'hsl(var(--accent-emerald))' }} />
            <h3 className="text-base font-extrabold tracking-[-0.014em]">Action Checklist</h3>
          </div>
          <div className="space-y-2">
            {data.actionChecklist.map((action, index) => (
              <RichParagraph key={index} text={`${index + 1}. ${action}`} className="reading-small" />
            ))}
          </div>
        </div>
      </div>

      {data.detailed && (
        <div className="card mt-4 p-5 md:p-6">
          <div className="mb-2 flex items-center gap-2">
            <NotebookPen className="h-4 w-4" style={{ color: 'hsl(var(--accent-indigo))' }} />
            <h3 className="text-base font-extrabold tracking-[-0.014em]">Detailed Summary</h3>
          </div>
          <RichParagraph text={data.detailed} className="reading-body whitespace-pre-line" />
        </div>
      )}
    </motion.section>
  );
}
