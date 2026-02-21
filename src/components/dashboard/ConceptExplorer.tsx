'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  ChevronDown,
  Lightbulb,
  Shapes,
  BadgeCheck,
  AlertTriangle,
  CircleHelp,
} from 'lucide-react';
import { Concept } from '@/lib/types';
import { RichParagraph } from './RichText';

interface ConceptExplorerProps {
  concepts: Concept[];
}

const colors = ['265 77% 60%', '212 92% 54%', '187 80% 43%', '152 62% 38%', '34 86% 48%', '346 76% 52%'];

export default function ConceptExplorer({ concepts }: ConceptExplorerProps) {
  const [expandedId, setExpandedId] = useState<number | null>(0);
  const [showAnswerMap, setShowAnswerMap] = useState<Record<number, boolean>>({});

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-cyan)/0.14)]">
          <Layers className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-cyan))' }} />
        </div>
        <div>
          <h2 className="section-title">Concept Explorer</h2>
          <p className="section-subtitle">
            Deep concept cards built for clarity and retention
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {concepts.map((concept, i) => {
          const isExpanded = expandedId === i;
          const color = colors[i % colors.length];

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.03 }}
              className="card overflow-hidden"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : i)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: `hsl(${color} / 0.14)` }}>
                  <Shapes className="h-4 w-4" style={{ color: `hsl(${color})` }} />
                </div>

                <span className="flex-1 text-[1.05rem] font-extrabold tracking-[-0.016em]" style={{ color: 'hsl(var(--text-primary))' }}>
                  {concept.name}
                </span>

                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="h-4 w-4" style={{ color: 'hsl(var(--text-muted))' }} />
                </motion.div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t px-5 pb-5 pt-4" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="reading-card rounded-xl border p-4" style={{ borderColor: `hsl(${color} / 0.25)`, background: `hsl(${color} / 0.08)` }}>
                          <p className="eyebrow-label mb-1" style={{ color: `hsl(${color})` }}>
                            Intuition
                          </p>
                          <RichParagraph text={concept.intuition} className="reading-body" />
                        </div>

                        <div className="reading-card rounded-xl border p-4" style={{ borderColor: `hsl(${color} / 0.25)` }}>
                          <p className="eyebrow-label mb-1" style={{ color: `hsl(${color})` }}>
                            Technical Definition
                          </p>
                          <RichParagraph text={concept.technicalDefinition} className="reading-body" />
                        </div>
                      </div>

                      <div className="reading-card mt-4 rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                        <p className="eyebrow-label mb-1" style={{ color: 'hsl(var(--accent-blue))' }}>
                          Why it matters
                        </p>
                        <RichParagraph text={concept.whyImportant} className="mb-3 reading-body" />

                        <div className="flex items-start gap-2">
                          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--accent-amber))' }} />
                          <RichParagraph text={concept.analogy} className="reading-body" />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="eyebrow-label mb-2 flex items-center gap-2" style={{ color: 'hsl(var(--accent-emerald))' }}>
                            <BadgeCheck className="h-3.5 w-3.5" /> Prerequisites
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {concept.prerequisites.map((item, idx) => (
                              <span key={idx} className="rounded-full border px-2.5 py-1 text-[0.8rem] font-semibold" style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))' }}>
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <p className="eyebrow-label mb-2 flex items-center gap-2" style={{ color: 'hsl(var(--accent-rose))' }}>
                            <AlertTriangle className="h-3.5 w-3.5" /> Common Pitfalls
                          </p>
                          <div className="space-y-1.5">
                            {concept.pitfalls.map((item, idx) => (
                              <RichParagraph key={idx} text={`• ${item}`} className="reading-small" />
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="reading-card mt-4 rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-secondary) / 0.78)' }}>
                        <p className="eyebrow-label mb-2" style={{ color: 'hsl(var(--accent-indigo))' }}>
                          Permanent takeaway
                        </p>
                        <RichParagraph text={concept.takeaway} className="reading-body" />
                      </div>

                      <div className="reading-card mt-4 rounded-xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
                        <p className="eyebrow-label mb-2 flex items-center gap-2" style={{ color: 'hsl(var(--accent-blue))' }}>
                          <CircleHelp className="h-3.5 w-3.5" /> Mini Quiz
                        </p>
                        <RichParagraph text={concept.miniQuiz.question} className="reading-body font-semibold" />

                        <button
                          onClick={() =>
                            setShowAnswerMap((prev) => ({ ...prev, [i]: !prev[i] }))
                          }
                          className="mt-2 text-[0.84rem] font-semibold underline"
                          style={{ color: 'hsl(var(--accent-blue))' }}
                        >
                          {showAnswerMap[i] ? 'Hide answer' : 'Show answer'}
                        </button>

                        {showAnswerMap[i] && (
                          <RichParagraph text={concept.miniQuiz.answer} className="mt-2 reading-small" />
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}
