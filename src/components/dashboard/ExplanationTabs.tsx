'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, GraduationCap, Code2, Atom } from 'lucide-react';
import { Explanations } from '@/lib/types';
import { RichParagraph } from './RichText';

interface ExplanationTabsProps {
  data: Explanations;
}

const tabs = [
  { key: 'eli15' as const, label: 'Simple', icon: GraduationCap, color: '152 62% 38%' },
  { key: 'engineer' as const, label: 'Engineer', icon: Code2, color: '212 92% 54%' },
  { key: 'deep' as const, label: 'Deep Technical', icon: Atom, color: '265 77% 60%' },
];

export default function ExplanationTabs({ data }: ExplanationTabsProps) {
  const [active, setActive] = useState<'eli15' | 'engineer' | 'deep'>('eli15');

  const contentMap = {
    eli15: data.eli15,
    engineer: data.engineer,
    deep: data.deepTechnical,
  };
  const paragraphs = contentMap[active]
    .split(/\n\s*\n/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const activeTab = tabs.find((tab) => tab.key === active);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-blue)/0.14)]">
          <Brain className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-blue))' }} />
        </div>
        <div>
          <h2 className="section-title">Explanations</h2>
          <p className="section-subtitle">
            Choose your level of depth
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={`explanation-tab-pill inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-[0.95rem] font-semibold transition-all ${
                isActive ? 'explanation-tab-pill-active' : ''
              }`}
              style={{
                borderColor: isActive ? `hsl(${tab.color} / 0.52)` : undefined,
                color: isActive ? `hsl(${tab.color})` : undefined,
              }}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="card reading-card p-6 md:p-7"
          style={{ borderLeft: `4px solid hsl(${activeTab?.color} / 0.4)` }}
        >
          <p className="eyebrow-label mb-3" style={{ color: `hsl(${activeTab?.color})` }}>
            {activeTab?.label}
          </p>

          <div className="space-y-3.5">
            {paragraphs.map((paragraph, index) => (
              <div
                key={index}
                className="rounded-lg border px-4 py-3"
                style={{
                  borderColor: 'hsl(var(--border-subtle))',
                  background: index % 2 === 0 ? 'hsl(var(--bg-secondary) / 0.55)' : 'transparent',
                }}
              >
                <RichParagraph text={paragraph} className={index === 0 ? 'reading-lead' : 'reading-body'} />
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}
