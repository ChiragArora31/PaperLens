'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import type { PaperAnalysis } from '@/lib/types';

interface ExportSummaryButtonProps {
  analysis: PaperAnalysis;
}

export default function ExportSummaryButton({ analysis }: ExportSummaryButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const downloadPdf = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/paper/export-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setError(payload.error || 'Could not generate PDF summary.');
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = analysis.metadata.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60);
      a.download = `${safeName || 'paperlens-summary'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate PDF summary.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button onClick={downloadPdf} disabled={isLoading} className="stat-pill">
        {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
        Download summary PDF
      </button>
      {error && (
        <span className="text-xs" style={{ color: 'hsl(var(--accent-rose))' }}>
          {error}
        </span>
      )}
    </div>
  );
}
