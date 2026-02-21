'use client';

import { useEffect, useRef, useState, type ComponentType, type CSSProperties } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  Sparkles,
  ScrollText,
  Brain,
  Eye,
  Layers,
  Route,
  FileText,
  ExternalLink,
  Calendar,
  Users,
} from 'lucide-react';
import { PaperAnalysis } from '@/lib/types';
import ThemeToggle from '@/components/ThemeToggle';
import TldrSection from './TldrSection';
import ExplanationTabs from './ExplanationTabs';
import MermaidDiagram from './MermaidDiagram';
import ConceptExplorer from './ConceptExplorer';
import PaperBreakdown from './PaperBreakdown';
import WhyCareSection from './WhyCareSection';
import SummarySuiteSection from './SummarySuiteSection';
import LearningPathSection from './LearningPathSection';
import InfographicDiagrams from './InfographicDiagrams';

interface DashboardProps {
  analysis: PaperAnalysis;
  onBack: () => void;
}

const sections = [
  { id: 'tldr', label: 'TL;DR', icon: Sparkles },
  { id: 'summary-suite', label: 'Summaries', icon: ScrollText },
  { id: 'explanations', label: 'Explanations', icon: Brain },
  { id: 'diagrams', label: 'Diagrams', icon: Eye },
  { id: 'concepts', label: 'Concepts', icon: Layers },
  { id: 'path', label: 'Path', icon: Route },
  { id: 'breakdown', label: 'Breakdown', icon: FileText },
  { id: 'impact', label: 'Impact', icon: ExternalLink },
];

export default function Dashboard({ analysis, onBack }: DashboardProps) {
  const [activeSection, setActiveSection] = useState('tldr');
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0.35, rootMargin: '-100px 0px -40% 0px' }
    );

    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    sectionRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const meta = analysis.metadata;
  const mermaidDiagrams = analysis.diagrams.slice(0, 2);
  const publishedDate = (() => {
    if (!meta.published) return '';
    const parsed = new Date(meta.published);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
    });
  })();

  return (
    <div className="min-h-screen gradient-bg noise-overlay">
      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-6 md:px-10 md:pt-8">
        <nav className="dashboard-nav-shell sticky top-4 z-40 mb-8 rounded-2xl px-4 py-3 md:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={onBack}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ borderColor: 'hsl(var(--border))', color: 'hsl(var(--text-secondary))' }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="hidden items-center gap-2 md:flex">
                <BookOpen className="h-4 w-4" style={{ color: 'hsl(var(--accent-blue))' }} />
                <span className="brand-wordmark" style={{ fontSize: '1.12rem' }}>
                  PaperLens
                </span>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 md:w-auto">
              <div
                className="dashboard-nav-tabs flex flex-1 gap-1 overflow-x-auto rounded-xl border p-1 md:flex-none"
                style={{ borderColor: 'hsl(var(--border-subtle))', scrollbarWidth: 'none' }}
              >
                {sections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => scrollToSection(section.id)}
                    className={`dashboard-nav-tab inline-flex min-w-fit items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[0.9rem] font-bold transition-all ${
                      activeSection === section.id ? 'dashboard-nav-tab-active' : ''
                    }`}
                  >
                    <section.icon className="h-3.5 w-3.5" />
                    {section.label}
                  </button>
                ))}
              </div>
              <ThemeToggle />
            </div>
          </div>
        </nav>

        <header className="card mb-10 p-6 md:p-8">
          <h1 className="mb-4 text-[clamp(2rem,1.5rem+2vw,3rem)] font-extrabold leading-[1.04] tracking-[-0.03em]" style={{ color: 'hsl(var(--text-primary))' }}>
            {meta.title}
          </h1>

          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            {meta.authors.length > 0 && (
              <div className="stat-pill">
                <Users className="h-3.5 w-3.5" />
                <span>
                  {meta.authors.slice(0, 3).join(', ')}
                  {meta.authors.length > 3 && ` +${meta.authors.length - 3}`}
                </span>
              </div>
            )}

            {publishedDate && (
              <div className="stat-pill">
                <Calendar className="h-3.5 w-3.5" />
                <span>{publishedDate}</span>
              </div>
            )}

            {meta.id && (
              <a
                href={`https://arxiv.org/abs/${meta.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="stat-pill transition-all hover:-translate-y-0.5"
                style={{ textDecoration: 'none' }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>arXiv:{meta.id}</span>
              </a>
            )}
          </div>

          <p className="reading-body" style={{ color: 'hsl(var(--text-secondary))' }}>
            This is your guided learning view. Move from quick understanding to deep technical detail
            with clear, structured sections.
          </p>
        </header>

        <div className="space-y-16">
          <div
            id="tldr"
            ref={(el) => {
              if (el) sectionRefs.current.set('tldr', el);
            }}
            className="scroll-mt-36"
          >
            <TldrSection data={analysis.tldr} />
          </div>

          <div
            id="summary-suite"
            ref={(el) => {
              if (el) sectionRefs.current.set('summary-suite', el);
            }}
            className="scroll-mt-36"
          >
            <SummarySuiteSection data={analysis.summarySuite} />
          </div>

          <div
            id="explanations"
            ref={(el) => {
              if (el) sectionRefs.current.set('explanations', el);
            }}
            className="scroll-mt-36"
          >
            <ExplanationTabs data={analysis.explanations} />
          </div>

          <div
            id="diagrams"
            ref={(el) => {
              if (el) sectionRefs.current.set('diagrams', el);
            }}
            className="scroll-mt-36"
          >
            <SectionHeader
              icon={Eye}
              title="Visual Diagrams"
              subtitle="2 flowcharts + 2 intuition infographics for real understanding"
              color="212 92% 54%"
            />
            <div className="mt-6 space-y-8">
              <div>
                <p className="eyebrow-label mb-3" style={{ color: 'hsl(var(--accent-blue))' }}>
                  Flowcharts
                </p>
                <div className="grid gap-6 xl:grid-cols-2">
                  {mermaidDiagrams.map((diagram, i) => (
                    <MermaidDiagram key={i} diagram={diagram} />
                  ))}
                </div>
              </div>

              <div>
                <p className="eyebrow-label mb-3" style={{ color: 'hsl(var(--accent-indigo))' }}>
                  Intuition Infographics
                </p>
                <InfographicDiagrams analysis={analysis} />
              </div>
            </div>
          </div>

          <div
            id="concepts"
            ref={(el) => {
              if (el) sectionRefs.current.set('concepts', el);
            }}
            className="scroll-mt-36"
          >
            <ConceptExplorer concepts={analysis.concepts} />
          </div>

          <div
            id="path"
            ref={(el) => {
              if (el) sectionRefs.current.set('path', el);
            }}
            className="scroll-mt-36"
          >
            <LearningPathSection data={analysis.learningPath} />
          </div>

          <div
            id="breakdown"
            ref={(el) => {
              if (el) sectionRefs.current.set('breakdown', el);
            }}
            className="scroll-mt-36"
          >
            <PaperBreakdown sections={analysis.sections} />
          </div>

          <div
            id="impact"
            ref={(el) => {
              if (el) sectionRefs.current.set('impact', el);
            }}
            className="scroll-mt-36"
          >
            <WhyCareSection data={analysis.whyCare} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  color,
}: {
  icon: ComponentType<{ className?: string; style?: CSSProperties }>;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="flex items-start gap-4"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `hsl(${color} / 0.14)` }}>
        <Icon className="h-[18px] w-[18px]" style={{ color: `hsl(${color})` }} />
      </div>
      <div>
        <h2 className="section-title" style={{ color: 'hsl(var(--text-primary))' }}>
          {title}
        </h2>
        <p className="section-subtitle" style={{ color: 'hsl(var(--text-muted))' }}>
          {subtitle}
        </p>
      </div>
    </motion.div>
  );
}
