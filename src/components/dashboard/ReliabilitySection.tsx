'use client';

import { motion } from 'framer-motion';
import { ShieldCheck, AlertTriangle, FileSearch } from 'lucide-react';
import type { AnalysisReliability } from '@/lib/types';

interface ReliabilitySectionProps {
  reliability: AnalysisReliability;
}

const levelColor: Record<AnalysisReliability['level'], string> = {
  High: 'hsl(var(--accent-emerald))',
  Medium: 'hsl(var(--accent-amber))',
  Low: 'hsl(var(--accent-rose))',
};

export default function ReliabilitySection({ reliability }: ReliabilitySectionProps) {
  const stroke = Math.max(0, Math.min(100, reliability.score));

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-emerald)/0.16)]">
          <ShieldCheck className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-emerald))' }} />
        </div>
        <div>
          <h2 className="section-title">Reliability</h2>
          <p className="section-subtitle">Trust signals for extraction quality and evidence coverage</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <div className="card p-5">
          <div
            className="mx-auto flex h-[150px] w-[150px] items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${levelColor[reliability.level]} ${stroke * 3.6}deg, hsl(var(--border-subtle)) 0deg)`,
            }}
          >
            <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full" style={{ background: 'hsl(var(--bg-card))' }}>
              <p className="text-3xl font-black tracking-[-0.03em]" style={{ color: 'hsl(var(--text-primary))' }}>
                {reliability.score}
              </p>
              <p className="text-xs font-bold uppercase tracking-[0.08em]" style={{ color: levelColor[reliability.level] }}>
                {reliability.level}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="stat-pill w-full justify-between">
              <span>Source</span>
              <span className="font-bold uppercase">{reliability.source.replace('_', ' ')}</span>
            </div>
            <div className="stat-pill w-full justify-between">
              <span>Mode</span>
              <span className="font-bold uppercase">{reliability.modelMode}</span>
            </div>
            <div className="stat-pill w-full justify-between">
              <span>Evidence coverage</span>
              <span className="font-bold">{reliability.evidenceCoverage}%</span>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 flex items-center gap-2">
            <FileSearch className="h-4 w-4" style={{ color: 'hsl(var(--accent-blue))' }} />
            <h3 className="text-base font-extrabold tracking-[-0.014em]">Diagnostics</h3>
          </div>

          <div className="space-y-2.5">
            {reliability.notes.map((note, index) => (
              <div key={index} className="rounded-lg border px-3 py-2.5" style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-secondary) / 0.58)' }}>
                <p className="text-sm leading-relaxed" style={{ color: 'hsl(var(--text-secondary))' }}>
                  {note}
                </p>
              </div>
            ))}
          </div>

          {reliability.level === 'Low' && (
            <div
              className="mt-3 rounded-lg border px-3 py-2.5"
              style={{ borderColor: 'hsl(var(--accent-rose) / 0.34)', background: 'hsl(var(--accent-rose) / 0.08)' }}
            >
              <p className="inline-flex items-start gap-2 text-sm" style={{ color: 'hsl(var(--accent-rose))' }}>
                <AlertTriangle className="mt-0.5 h-4 w-4" />
                Reliability is low for this run. Use citations and section breakdown for careful verification.
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.section>
  );
}
