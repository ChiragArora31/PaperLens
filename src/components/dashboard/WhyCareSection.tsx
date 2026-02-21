'use client';

import { motion } from 'framer-motion';
import { Rocket, Globe, Building2, Lightbulb, ArrowUpRight } from 'lucide-react';
import { WhyCareData } from '@/lib/types';
import { RichInline, RichParagraph } from './RichText';

interface WhyCareSectionProps {
  data: WhyCareData;
}

export default function WhyCareSection({ data }: WhyCareSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-rose)/0.14)]">
          <Rocket className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-rose))' }} />
        </div>
        <div>
          <h2 className="section-title">Why this paper matters</h2>
          <p className="section-subtitle">
            Practical impact and adoption
          </p>
        </div>
      </div>

      {data.realWorldImpact && (
        <div className="card reading-card mb-6 p-6" style={{ borderLeft: '4px solid hsl(var(--accent-rose) / 0.4)' }}>
          <div className="mb-2 flex items-center gap-2">
            <Globe className="h-4 w-4" style={{ color: 'hsl(var(--accent-rose))' }} />
            <span className="eyebrow-label" style={{ color: 'hsl(var(--accent-rose))' }}>
              Real-world impact
            </span>
          </div>
          <RichParagraph text={data.realWorldImpact} className="reading-body" />
        </div>
      )}

      {data.useCases && data.useCases.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-extrabold tracking-[-0.015em]" style={{ color: 'hsl(var(--text-secondary))' }}>
            <Lightbulb className="h-4 w-4" style={{ color: 'hsl(var(--accent-amber))' }} />
            Use cases
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {data.useCases.map((useCase, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.04 }}
                className="card reading-card flex items-start gap-3 p-4"
              >
                <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--accent-amber))' }} />
                <RichInline text={useCase} className="reading-small leading-8" />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {data.companiesUsing && data.companiesUsing.length > 0 && (
        <div>
          <h3 className="mb-3 flex items-center gap-2 text-lg font-extrabold tracking-[-0.015em]" style={{ color: 'hsl(var(--text-secondary))' }}>
            <Building2 className="h-4 w-4" style={{ color: 'hsl(var(--accent-cyan))' }} />
            Who is using this
          </h3>

          <div className="flex flex-wrap gap-2">
            {data.companiesUsing.map((company, i) => (
              <motion.span
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="stat-pill"
              >
                {company}
              </motion.span>
            ))}
          </div>
        </div>
      )}

      {data.whyItsCool && (
        <div className="card reading-card mt-6 p-5">
          <h3 className="mb-2 text-lg font-extrabold tracking-[-0.015em]" style={{ color: 'hsl(var(--accent-indigo))' }}>
            Why this is exciting
          </h3>
          <RichParagraph text={data.whyItsCool} className="reading-body" />
        </div>
      )}
    </motion.section>
  );
}
