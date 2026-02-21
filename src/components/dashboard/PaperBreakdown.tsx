'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, ChevronDown, Hash } from 'lucide-react';
import { PaperSection } from '@/lib/types';
import { RichParagraph } from './RichText';

interface PaperBreakdownProps {
  sections: PaperSection[];
}

export default function PaperBreakdown({ sections }: PaperBreakdownProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-amber)/0.14)]">
          <FileText className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-amber))' }} />
        </div>
        <div>
          <h2 className="section-title">Paper Breakdown</h2>
          <p className="section-subtitle">
            Section-by-section interpretation in simple language
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section, i) => {
          const isExpanded = expandedIndex === i;

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
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="flex w-full items-center gap-4 px-5 py-4 text-left"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--accent-amber)/0.14)] text-sm font-bold" style={{ color: 'hsl(var(--accent-amber))' }}>
                  {i + 1}
                </div>
                <span className="flex-1 text-[1.05rem] font-extrabold tracking-[-0.014em]" style={{ color: 'hsl(var(--text-primary))' }}>
                  {section.title}
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
                      <div className="space-y-3">
                        {section.simplified
                          .split(/\n\s*\n/g)
                          .map((paragraph) => paragraph.trim())
                          .filter(Boolean)
                          .map((paragraph, idx) => (
                            <RichParagraph
                              key={idx}
                              text={paragraph}
                              className={idx === 0 ? 'reading-lead' : 'reading-body'}
                            />
                          ))}
                      </div>

                      {section.keyPoints && section.keyPoints.length > 0 && (
                        <div className="mt-4 space-y-2.5">
                          {section.keyPoints.map((point, j) => (
                            <div key={j} className="flex items-start gap-2.5">
                              <Hash className="mt-1 h-4 w-4 shrink-0" style={{ color: 'hsl(var(--accent-amber) / 0.72)' }} />
                              <RichParagraph text={point} className="reading-small" />
                            </div>
                          ))}
                        </div>
                      )}
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
