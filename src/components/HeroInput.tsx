'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Loader2, Link2 } from 'lucide-react';
import { extractArxivId } from '@/lib/arxiv';

interface HeroInputProps {
  onAnalyze: (data: { arxivId: string }) => void;
  isLoading: boolean;
}

const examples = [
  { label: 'Attention', id: '1706.03762' },
  { label: 'BERT', id: '1810.04805' },
  { label: 'Diffusion', id: '2006.11239' },
];

export default function HeroInput({ onAnalyze, isLoading }: HeroInputProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = input.trim();
    if (!trimmed) {
      setError('Paste an arXiv link or id.');
      return;
    }

    const arxivId = extractArxivId(trimmed);
    if (!arxivId) {
      setError('Use format like 1706.03762 or https://arxiv.org/abs/1706.03762');
      return;
    }

    onAnalyze({ arxivId });
  };

  return (
    <div>
      <div className="input-glow" style={{ borderRadius: 'var(--radius-lg)' }}>
        <form
          onSubmit={handleSubmit}
          className="paper-input-shell overflow-hidden"
        >
          <div className="flex flex-col gap-2.5 p-2.5 md:flex-row md:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3.5 py-3">
              <Search className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--text-dim))' }} />
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setError('');
                }}
                placeholder="Paste arXiv URL or ID"
                disabled={isLoading}
                className="paper-input-field w-full bg-transparent text-[1.02rem] font-medium outline-none"
                style={{ color: 'hsl(var(--text-primary))' }}
              />
            </div>

            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.98 }}
              type="submit"
              disabled={isLoading}
              className="shimmer-btn inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-bold text-white md:w-auto"
              style={{
                background: 'linear-gradient(120deg, hsl(var(--accent-indigo)), hsl(var(--accent-blue)), hsl(var(--accent-cyan)))',
                opacity: isLoading ? 0.75 : 1,
                boxShadow: '0 8px 18px hsl(var(--accent-blue) / 0.26)',
              }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze
                </>
              )}
            </motion.button>
          </div>
        </form>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold" style={{ borderColor: 'hsl(var(--border-subtle))', color: 'hsl(var(--text-secondary))', background: 'hsl(var(--bg-secondary) / 0.62)' }}>
          <Link2 className="h-4 w-4" />
          arXiv links and IDs only
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'hsl(var(--text-muted))' }}>
          <span>Examples:</span>
          {examples.map((example) => (
            <button
              key={example.id}
              onClick={() => {
                setInput(example.id);
                setError('');
              }}
              className="rounded-md border px-2.5 py-1 text-xs font-semibold transition-all hover:-translate-y-0.5"
              style={{ borderColor: 'hsl(var(--border-subtle))', background: 'hsl(var(--bg-secondary) / 0.7)' }}
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-3 text-sm"
            style={{ color: 'hsl(var(--accent-rose))' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
