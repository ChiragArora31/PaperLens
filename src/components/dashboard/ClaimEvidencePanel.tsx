'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Quote, ShieldCheck } from 'lucide-react';
import type { CitationSnippet } from '@/lib/types';

interface ClaimEvidencePanelProps {
  title?: string;
  citations: CitationSnippet[];
}

function formatSnippet(text: string): string {
  const clean = text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();

  if (!clean) return '';
  if (clean.length <= 460) return clean;

  const slice = clean.slice(0, 460);
  const stop = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf(' '));
  return `${slice.slice(0, stop > 260 ? stop : 460).trim()}...`;
}

export default function ClaimEvidencePanel({ title = 'Show evidence', citations }: ClaimEvidencePanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5"
        style={{
          borderColor: open ? 'hsl(var(--accent-blue) / 0.42)' : 'hsl(var(--border))',
          color: 'hsl(var(--text-secondary))',
          background: open ? 'hsl(var(--accent-blue) / 0.1)' : 'hsl(var(--bg-secondary) / 0.55)',
        }}
      >
        <ShieldCheck className="h-4 w-4" style={{ color: 'hsl(var(--accent-emerald))' }} />
        {title}
        <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ borderColor: 'hsl(var(--border-subtle))' }}>
          {citations.length}
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {citations.length === 0 ? (
            <div
              className="rounded-xl border px-3.5 py-3 text-sm"
              style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-muted))' }}
            >
              No direct citation snippet is available for this claim yet.
            </div>
          ) : (
            citations.map((citation, index) => (
              <article
                key={`${citation.page}-${index}`}
                className="rounded-xl border px-4 py-3.5"
                style={{
                  borderColor: 'hsl(var(--accent-blue) / 0.26)',
                  background: 'linear-gradient(135deg, hsl(var(--accent-blue) / 0.08), hsl(var(--accent-indigo) / 0.08))',
                }}
              >
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.08em]" style={{ color: 'hsl(var(--accent-blue))' }}>
                    <Quote className="h-3.5 w-3.5" />
                    Evidence · Page {citation.page}
                  </p>
                  {typeof citation.score === 'number' && (
                    <span className="text-[11px] font-bold" style={{ color: 'hsl(var(--text-muted))' }}>
                      Relevance {Math.round(citation.score * 100)}%
                    </span>
                  )}
                </div>
                <p
                  className="text-[0.96rem] leading-[1.75]"
                  style={{ color: 'hsl(var(--text-secondary))', textWrap: 'pretty' }}
                >
                  {formatSnippet(citation.text)}
                </p>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}
