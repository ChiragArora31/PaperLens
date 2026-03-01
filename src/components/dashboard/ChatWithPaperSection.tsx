'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Bot, Loader2, MessageSquareText, SendHorizonal, UserRound } from 'lucide-react';
import { motion } from 'framer-motion';

interface Citation {
  page: number;
  text: string;
  score?: number;
}

interface ChatItem {
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
}

interface ChatWithPaperSectionProps {
  arxivId: string;
}

export default function ChatWithPaperSection({ arxivId }: ChatWithPaperSectionProps) {
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      role: 'assistant',
      content:
        'Ask anything about this paper. I answer with evidence-backed citations and page numbers.',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const trimmedHistory = useMemo(
    () =>
      messages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({ role: message.role, content: message.content }))
        .slice(-8),
    [messages]
  );

  const askQuestion = async (event: FormEvent) => {
    event.preventDefault();
    const query = question.trim();
    if (query.length < 3 || isLoading) return;

    const nextMessages: ChatItem[] = [...messages, { role: 'user', content: query }];
    setMessages(nextMessages);
    setQuestion('');
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/paper/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          arxivId,
          question: query,
          history: trimmedHistory,
        }),
      });

      const result = (await response.json()) as {
        success?: boolean;
        error?: string;
        data?: { answer?: string; citations?: Citation[] };
      };

      if (!response.ok || !result.success || !result.data?.answer) {
        setError(result.error || 'Could not generate cited answer.');
        setMessages(nextMessages);
        return;
      }

      setMessages([
        ...nextMessages,
        {
          role: 'assistant',
          content: result.data.answer,
          citations: (result.data.citations ?? []).slice(0, 4),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate cited answer.');
      setMessages(nextMessages);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[hsl(var(--accent-indigo)/0.16)]">
          <MessageSquareText className="h-[18px] w-[18px]" style={{ color: 'hsl(var(--accent-indigo))' }} />
        </div>
        <div>
          <h2 className="section-title">Chat with Paper</h2>
          <p className="section-subtitle">Cited answers with page-level evidence from the paper</p>
        </div>
      </div>

      <div className="card p-4 md:p-5">
        <div className="max-h-[440px] space-y-3 overflow-y-auto pr-1">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className="rounded-2xl border p-4" style={{ borderColor: 'hsl(var(--border-subtle))', background: message.role === 'assistant' ? 'hsl(var(--bg-secondary) / 0.7)' : 'hsl(var(--accent-blue) / 0.1)' }}>
              <div className="mb-2 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em]" style={{ color: message.role === 'assistant' ? 'hsl(var(--accent-indigo))' : 'hsl(var(--accent-blue))' }}>
                {message.role === 'assistant' ? <Bot className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />}
                {message.role === 'assistant' ? 'PaperLens' : 'You'}
              </div>
              <p className="reading-small" style={{ color: 'hsl(var(--text-secondary))' }}>
                {message.content}
              </p>

              {message.role === 'assistant' && message.citations && message.citations.length > 0 && (
                <div className="mt-3 space-y-2">
                  {message.citations.map((citation, citationIndex) => (
                    <div
                      key={`${index}-${citation.page}-${citationIndex}`}
                      className="rounded-xl border px-3 py-2"
                      style={{
                        borderColor: 'hsl(var(--accent-indigo) / 0.25)',
                        background: 'hsl(var(--accent-indigo) / 0.08)',
                      }}
                    >
                      <p className="mb-1 text-xs font-bold uppercase tracking-[0.09em]" style={{ color: 'hsl(var(--accent-indigo))' }}>
                        Citation · Page {citation.page}
                      </p>
                      <p className="text-sm" style={{ color: 'hsl(var(--text-secondary))' }}>
                        {citation.text}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--text-muted))' }}>
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading evidence and drafting cited answer...
              </span>
            </div>
          )}
        </div>

        <form onSubmit={askQuestion} className="mt-4 flex flex-col gap-3 md:flex-row">
          <input
            value={question}
            onChange={(event) => {
              setQuestion(event.target.value);
              setError('');
            }}
            placeholder="Ask about assumptions, equations, architecture, or results"
            className="w-full flex-1 rounded-xl border px-4 py-3 text-sm font-medium"
            style={{ borderColor: 'hsl(var(--border))', background: 'hsl(var(--bg-secondary))' }}
          />
          <button type="submit" disabled={isLoading || question.trim().length < 3} className="landing-cta-primary md:h-[46px] md:px-6">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizonal className="h-4 w-4" />}
            Ask
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm" style={{ color: 'hsl(var(--accent-rose))' }}>
            {error}
          </p>
        )}
      </div>
    </motion.section>
  );
}
