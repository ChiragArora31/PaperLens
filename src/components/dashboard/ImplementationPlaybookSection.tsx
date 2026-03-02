'use client';

import { motion } from 'framer-motion';
import {
  Rocket,
  GitBranch,
  Code2,
  Bug,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import type { ImplementationPlaybook } from '@/lib/types';
import { RichParagraph } from './RichText';

interface ImplementationPlaybookSectionProps {
  data: ImplementationPlaybook;
}

export default function ImplementationPlaybookSection({ data }: ImplementationPlaybookSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-cyan)/0.14)]">
          <Rocket className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-cyan))' }} />
        </div>
        <div>
          <h2 className="section-title">Implementation Playbook</h2>
          <p className="section-subtitle">From paper understanding to a buildable system blueprint</p>
        </div>
      </div>

      <div className="card reading-card p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Rocket className="h-4 w-4" style={{ color: 'hsl(var(--accent-emerald))' }} />
          <h3 className="text-base font-extrabold tracking-[-0.014em]">Quick start</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {data.quickStart.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border px-4 py-3"
              style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-secondary) / 0.58)' }}
            >
              <p className="inline-flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[hsl(var(--accent-emerald)/0.15)] text-[11px] font-bold" style={{ color: 'hsl(var(--accent-emerald))' }}>
                  {index + 1}
                </span>
                <RichParagraph text={item} className="reading-small" />
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card reading-card p-5 md:p-6">
          <div className="mb-3 flex items-center gap-2">
            <GitBranch className="h-4 w-4" style={{ color: 'hsl(var(--accent-blue))' }} />
            <h3 className="text-base font-extrabold tracking-[-0.014em]">Architecture steps</h3>
          </div>

          <div className="space-y-3">
            {data.architectureSteps.map((step, index) => (
              <div key={index} className="rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                <div className="mb-2 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-black" style={{ background: 'hsl(var(--accent-blue) / 0.14)', color: 'hsl(var(--accent-blue))' }}>
                    {index + 1}
                  </span>
                  <p className="text-[1rem] font-bold tracking-[-0.01em]" style={{ color: 'hsl(var(--text-primary))' }}>
                    {step.step}
                  </p>
                </div>
                <RichParagraph text={step.detail} className="reading-small" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card reading-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <Bug className="h-4 w-4" style={{ color: 'hsl(var(--accent-rose))' }} />
              <h3 className="text-base font-extrabold tracking-[-0.014em]">Common bugs</h3>
            </div>
            <div className="space-y-2.5">
              {data.commonBugs.map((bug, index) => (
                <div key={index} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'hsl(var(--accent-rose) / 0.24)', background: 'hsl(var(--accent-rose) / 0.07)' }}>
                  <p className="inline-flex items-start gap-2 text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--accent-rose))' }} />
                    {bug}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="card reading-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" style={{ color: 'hsl(var(--accent-emerald))' }} />
              <h3 className="text-base font-extrabold tracking-[-0.014em]">Evaluation checklist</h3>
            </div>
            <div className="space-y-2.5">
              {data.evaluationChecklist.map((item, index) => (
                <div key={index} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'hsl(var(--accent-emerald) / 0.24)', background: 'hsl(var(--accent-emerald) / 0.07)' }}>
                  <p className="inline-flex items-start gap-2 text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(var(--accent-emerald))' }} />
                    {item}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card reading-card p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <Code2 className="h-4 w-4" style={{ color: 'hsl(var(--accent-indigo))' }} />
          <h3 className="text-base font-extrabold tracking-[-0.014em]">Pseudocode blueprint</h3>
        </div>
        <pre
          className="overflow-x-auto rounded-xl border p-4 text-[12.5px] leading-6"
          style={{
            borderColor: 'hsl(var(--border-subtle))',
            background: 'hsl(var(--bg-secondary) / 0.72)',
            color: 'hsl(var(--text-secondary))',
          }}
        >
          {data.pseudocode}
        </pre>
      </div>
    </motion.section>
  );
}
