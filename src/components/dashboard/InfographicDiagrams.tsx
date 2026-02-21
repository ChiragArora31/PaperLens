'use client';

import { motion } from 'framer-motion';
import { PaperAnalysis } from '@/lib/types';

interface InfographicDiagramsProps {
  analysis: PaperAnalysis;
}

type Stage = {
  title: string;
  detail: string;
  color: string;
  x: number;
  y: number;
};

const conceptColors = ['#5b6cff', '#2e88ff', '#10b6cf', '#00b98d', '#f39b28', '#f15a82'];

function toLine(text: string, max = 30): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}...`;
}

function cleanFallback(text: string | undefined, fallback: string): string {
  if (!text) return fallback;
  const normalized = text.replace(/\s+/g, ' ').trim();
  return normalized || fallback;
}

export default function InfographicDiagrams({ analysis }: InfographicDiagramsProps) {
  const concepts = analysis.concepts.slice(0, 6);

  const conceptNodes = concepts.map((concept, index) => ({
    label: toLine(concept.name, 24),
    color: conceptColors[index % conceptColors.length],
  }));

  while (conceptNodes.length < 6) {
    conceptNodes.push({
      label: `Concept ${conceptNodes.length + 1}`,
      color: conceptColors[conceptNodes.length % conceptColors.length],
    });
  }

  const layout = [
    { x: 130, y: 100 },
    { x: 380, y: 66 },
    { x: 630, y: 100 },
    { x: 130, y: 320 },
    { x: 380, y: 356 },
    { x: 630, y: 320 },
  ];

  const coreLabel = cleanFallback(
    analysis.tldr.hook || analysis.tldr.summary || analysis.metadata.title,
    'Core paper idea'
  );

  const useCases = analysis.whyCare.useCases.slice(0, 4);
  const sectionTitle = analysis.sections[0]?.title || 'Method and Results';
  const firstStep = analysis.learningPath.steps[0]?.goal || 'Understand the paper objective clearly.';
  const evidence = analysis.sections[1]?.keyPoints[0] || analysis.tldr.keyTakeaways[1] || 'Experimental evidence supports the claims.';
  const impact = useCases[0] || analysis.whyCare.realWorldImpact || 'Practical applications emerge from this method.';

  const stages: Stage[] = [
    {
      title: 'Problem Lens',
      detail: toLine(analysis.tldr.keyTakeaways[0] || analysis.tldr.summary, 64),
      color: '#4b7dff',
      x: 40,
      y: 108,
    },
    {
      title: 'Method Core',
      detail: toLine(firstStep || sectionTitle, 64),
      color: '#17a4ff',
      x: 228,
      y: 108,
    },
    {
      title: 'Evidence',
      detail: toLine(evidence, 64),
      color: '#0fae9f',
      x: 416,
      y: 108,
    },
    {
      title: 'Real Impact',
      detail: toLine(impact, 64),
      color: '#9a62ff',
      x: 604,
      y: 108,
    },
  ];

  return (
    <div className="visual-lab-grid mt-8 grid gap-6 xl:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35 }}
        className="visual-lab-card"
      >
        <div className="visual-lab-title-wrap">
          <h3 className="visual-lab-title">Concept Constellation</h3>
          <p className="visual-lab-subtitle">See how the paper&apos;s key ideas orbit one central contribution.</p>
        </div>

        <svg viewBox="0 0 760 420" className="visual-lab-svg" aria-label="Concept constellation infographic">
          <defs>
            <linearGradient id="constellationBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0f1b3d" />
              <stop offset="50%" stopColor="#111733" />
              <stop offset="100%" stopColor="#1b1538" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="760" height="420" rx="24" fill="url(#constellationBg)" />
          <circle cx="380" cy="210" r="74" fill="#182651" stroke="#4d7fff" strokeWidth="2.5" />
          <text x="380" y="203" textAnchor="middle" fill="#eaf0ff" fontSize="14" fontWeight="700">
            Core Idea
          </text>
          <text x="380" y="223" textAnchor="middle" fill="#9db5ff" fontSize="12">
            {toLine(coreLabel, 28)}
          </text>

          {layout.map((point, index) => {
            const node = conceptNodes[index];
            return (
              <g key={index}>
                <line
                  x1="380"
                  y1="210"
                  x2={point.x}
                  y2={point.y}
                  stroke={node.color}
                  strokeOpacity="0.65"
                  strokeWidth="2"
                  strokeDasharray="5 6"
                />
                <circle cx={point.x} cy={point.y} r="42" fill="#101a38" stroke={node.color} strokeWidth="2.4" />
                <text x={point.x} y={point.y - 4} textAnchor="middle" fill="#f1f5ff" fontSize="12" fontWeight="700">
                  {toLine(node.label, 16)}
                </text>
                <text x={point.x} y={point.y + 14} textAnchor="middle" fill={node.color} fontSize="11" fontWeight="600">
                  C{index + 1}
                </text>
              </g>
            );
          })}
        </svg>

        <p className="visual-lab-note">
          Use this map to explain the paper in interviews: start from the center and expand one concept at a time.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.35, delay: 0.05 }}
        className="visual-lab-card"
      >
        <div className="visual-lab-title-wrap">
          <h3 className="visual-lab-title">Paper-to-Impact Blueprint</h3>
          <p className="visual-lab-subtitle">Trace the paper from research question to practical outcomes.</p>
        </div>

        <svg viewBox="0 0 760 420" className="visual-lab-svg" aria-label="Paper to impact infographic">
          <defs>
            <linearGradient id="pipelineBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#101b33" />
              <stop offset="100%" stopColor="#14133b" />
            </linearGradient>
          </defs>

          <rect x="0" y="0" width="760" height="420" rx="24" fill="url(#pipelineBg)" />

          {stages.map((stage, index) => (
            <g key={stage.title}>
              <rect
                x={stage.x}
                y={stage.y}
                width="150"
                height="130"
                rx="18"
                fill="#0f1834"
                stroke={stage.color}
                strokeWidth="2.5"
              />
              <text x={stage.x + 75} y={stage.y + 26} textAnchor="middle" fill={stage.color} fontSize="12" fontWeight="700">
                {stage.title}
              </text>
              <text x={stage.x + 75} y={stage.y + 56} textAnchor="middle" fill="#f2f7ff" fontSize="12" fontWeight="600">
                {toLine(stage.detail, 18)}
              </text>
              <text x={stage.x + 75} y={stage.y + 74} textAnchor="middle" fill="#b3c1e8" fontSize="12" fontWeight="600">
                {toLine(stage.detail.slice(18), 18)}
              </text>

              {index < stages.length - 1 && (
                <g>
                  <line
                    x1={stage.x + 150}
                    y1={stage.y + 64}
                    x2={stages[index + 1].x - 12}
                    y2={stages[index + 1].y + 64}
                    stroke="#7a95ff"
                    strokeWidth="2.4"
                    strokeDasharray="6 7"
                  />
                  <polygon
                    points={`${stages[index + 1].x - 12},${stages[index + 1].y + 64} ${stages[index + 1].x - 22},${stages[index + 1].y + 58} ${stages[index + 1].x - 22},${stages[index + 1].y + 70}`}
                    fill="#7a95ff"
                  />
                </g>
              )}
            </g>
          ))}

          <rect x="34" y="286" width="692" height="100" rx="18" fill="#10182f" stroke="#2fb2c8" strokeWidth="2" strokeDasharray="8 6" />
          <text x="58" y="314" fill="#48d8e0" fontSize="13" fontWeight="700">
            Practical use-case lane
          </text>
          {useCases.slice(0, 3).map((useCase, index) => (
            <g key={useCase}>
              <rect x={58 + index * 222} y="327" width="206" height="42" rx="12" fill="#162347" stroke="#3a60f7" strokeWidth="1.3" />
              <text x={161 + index * 222} y="352" textAnchor="middle" fill="#e8efff" fontSize="12" fontWeight="600">
                {toLine(useCase, 28)}
              </text>
            </g>
          ))}
        </svg>

        <p className="visual-lab-note">
          Use this blueprint for study order: understand problem, inspect method, verify evidence, then anchor real impact.
        </p>
      </motion.div>
    </div>
  );
}
