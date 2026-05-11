'use client';

import { useState } from 'react';
import { Check, Loader2, Share2 } from 'lucide-react';
import type { PaperAnalysis } from '@/lib/types';

export default function SharePaperButton({ analysis }: { analysis: PaperAnalysis }) {
  const [state, setState] = useState<'idle' | 'loading' | 'copied'>('idle');
  const [error, setError] = useState('');
  const [shareUrl, setShareUrl] = useState('');

  const copyToClipboard = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }

    const element = document.createElement('textarea');
    element.value = value;
    element.setAttribute('readonly', '');
    element.style.position = 'fixed';
    element.style.opacity = '0';
    document.body.appendChild(element);
    element.select();
    document.execCommand('copy');
    element.remove();
  };

  const share = async () => {
    if (state === 'loading') return;
    setState('loading');
    setError('');
    setShareUrl('');

    try {
      const response = await fetch('/api/paper/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      });
      const result = (await response.json()) as { success?: boolean; data?: { url?: string }; error?: string };
      if (!response.ok || !result.success || !result.data?.url) {
        setError(result.error || 'Could not create share link.');
        setState('idle');
        return;
      }

      const absoluteUrl = new URL(result.data.url, window.location.origin).toString();
      setShareUrl(absoluteUrl);
      try {
        await copyToClipboard(absoluteUrl);
      } catch {
        setError('Share link created. Copy it from the link below.');
        setState('idle');
        return;
      }
      setState('copied');
      window.setTimeout(() => setState('idle'), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create share link.');
      setState('idle');
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button onClick={() => void share()} disabled={state === 'loading'} className="stat-pill">
        {state === 'loading' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : state === 'copied' ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Share2 className="h-3.5 w-3.5" />
        )}
        {state === 'copied' ? 'Link copied' : 'Share breakdown'}
      </button>
      {error && <span className="text-xs" style={{ color: 'hsl(var(--accent-rose))' }}>{error}</span>}
      {shareUrl && error && (
        <a href={shareUrl} className="text-xs font-semibold" style={{ color: 'hsl(var(--accent-blue))' }}>
          Open share page
        </a>
      )}
    </div>
  );
}
