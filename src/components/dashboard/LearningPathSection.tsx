'use client';

import { motion } from 'framer-motion';
import { Route, Clock3, Target, CheckCircle2 } from 'lucide-react';
import { LearningPath } from '@/lib/types';
import { RichParagraph } from './RichText';

interface LearningPathSectionProps {
  data: LearningPath;
}

export default function LearningPathSection({ data }: LearningPathSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-blue)/0.14)]">
          <Route className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-blue))' }} />
        </div>
        <div>
          <h2 className="section-title">Learning Path</h2>
          <p className="section-subtitle">
            Structured study journey for this paper
          </p>
        </div>
      </div>

      <div className="card reading-card p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="stat-pill">
            <Clock3 className="h-3.5 w-3.5" />
            {Math.max(1, data.totalMinutes)} min plan
          </span>
          <RichParagraph text={data.strategy} className="reading-small" />
        </div>

        <div className="space-y-4">
          {data.steps.map((step, index) => (
            <div
              key={index}
              className="reading-card rounded-xl border p-4"
              style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-secondary) / 0.72)' }}
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-base font-extrabold tracking-[-0.014em]" style={{ color: 'hsl(var(--text-primary))' }}>
                  Step {index + 1}: {step.stepTitle}
                </p>
                <span className="text-sm font-semibold" style={{ color: 'hsl(var(--text-muted))' }}>
                  ~{Math.max(1, step.estimatedMinutes)} min
                </span>
              </div>
              <div className="mb-2 flex items-start gap-2" style={{ color: 'hsl(var(--text-secondary))' }}>
                <Target className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--accent-blue))' }} />
                <RichParagraph text={step.goal} className="reading-small" />
              </div>
              <div className="flex items-start gap-2" style={{ color: 'hsl(var(--text-secondary))' }}>
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--accent-emerald))' }} />
                <RichParagraph text={step.output} className="reading-small" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
