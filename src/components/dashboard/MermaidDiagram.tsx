'use client';

import { useEffect, useState } from 'react';
import { DiagramData } from '@/lib/types';
import { AlertCircle } from 'lucide-react';

interface MermaidDiagramProps {
  diagram: DiagramData;
}

function fallbackCode(title: string): string {
  const safeTitle = title.replace(/[\[\]{}()"'`<>]/g, '').slice(0, 36) || 'Paper Concept';
  return `graph TD\n  A["${safeTitle}"] --> B["Core Idea"]\n  B --> C["How It Works"]\n  C --> D["Why It Matters"]`;
}

export default function MermaidDiagram({ diagram }: MermaidDiagramProps) {
  const [error, setError] = useState(false);
  const [svgContent, setSvgContent] = useState('');
  const [usedFallback, setUsedFallback] = useState(false);

  useEffect(() => {
    const renderDiagram = async () => {
      setError(false);
      setUsedFallback(false);
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: 'base',
          themeVariables: {
            primaryColor: '#eef2ff',
            primaryTextColor: '#17213b',
            primaryBorderColor: '#8ea0ff',
            lineColor: '#4f70ff',
            secondaryColor: '#f8faff',
            tertiaryColor: '#f3f7ff',
            fontFamily: 'Cabinet Grotesk, Manrope, sans-serif',
            fontSize: '14px',
          },
          flowchart: { curve: 'basis', padding: 18 },
          securityLevel: 'loose',
        });

        const render = async (code: string) => {
          const id = `mermaid-${Math.random().toString(36).slice(2, 9)}`;
          const { svg } = await mermaid.render(id, code);
          return svg;
        };

        try {
          const svg = await render(diagram.code);
          setSvgContent(svg);
        } catch {
          const svg = await render(fallbackCode(diagram.title));
          setSvgContent(svg);
          setUsedFallback(true);
        }
      } catch (err) {
        console.error('Mermaid render error:', err);
        setError(true);
      }
    };

    renderDiagram();
  }, [diagram.code, diagram.title]);

  if (error) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border p-4"
        style={{ borderColor: 'hsl(var(--accent-rose) / 0.28)', background: 'hsl(var(--accent-rose) / 0.06)' }}
      >
        <AlertCircle className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--accent-rose))' }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: 'hsl(var(--text-secondary))' }}>
            Diagram could not be rendered
          </p>
          <p className="text-xs" style={{ color: 'hsl(var(--text-muted))' }}>
            Please retry analysis. We generate guaranteed fallback diagrams by default.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="visual-lab-card">
      {diagram.title && (
        <h3 className="mb-2 text-2xl font-extrabold tracking-[-0.024em]" style={{ color: 'hsl(var(--text-primary))' }}>
          {diagram.title}
        </h3>
      )}

      <div className="mermaid-container" dangerouslySetInnerHTML={svgContent ? { __html: svgContent } : undefined} />

      {diagram.description && (
        <p className="mt-3 reading-small" style={{ color: 'hsl(var(--text-muted))' }}>
          {diagram.description}
        </p>
      )}

      {usedFallback && (
        <p className="mt-2 text-xs font-semibold" style={{ color: 'hsl(var(--accent-amber))' }}>
          Showing a safe fallback diagram for guaranteed rendering.
        </p>
      )}
    </div>
  );
}
