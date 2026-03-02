// ===== PaperLens Core Types =====

export interface PaperMetadata {
  id: string;
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  published: string;
  pdfUrl: string;
}

export type DifficultyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface TldrData {
  summary: string;
  keyTakeaways: string[];
  whyItMatters: string;
  difficulty: DifficultyLevel;
  hook?: string;
}

export interface SummarySuite {
  ultraShort: string;
  oneMinute: string;
  fiveMinute: string;
  detailed: string;
  revisionQuestions: string[];
  actionChecklist: string[];
}

export interface Explanations {
  eli15: string;
  engineer: string;
  deepTechnical: string;
}

export interface MiniQuiz {
  question: string;
  answer: string;
}

export interface Concept {
  name: string;
  intuition: string;
  technicalDefinition: string;
  whyImportant: string;
  analogy: string;
  prerequisites: string[];
  pitfalls: string[];
  takeaway: string;
  miniQuiz: MiniQuiz;
  diagram?: string;
}

export interface DiagramData {
  title: string;
  description: string;
  code: string;
}

export interface PaperSection {
  title: string;
  simplified: string;
  keyPoints: string[];
}

export interface LearningPathStep {
  stepTitle: string;
  goal: string;
  estimatedMinutes: number;
  output: string;
}

export interface LearningPath {
  totalMinutes: number;
  strategy: string;
  steps: LearningPathStep[];
}

export interface WhyCareData {
  realWorldImpact: string;
  useCases: string[];
  companiesUsing: string[];
  whyItsCool: string;
}

export interface SimilarPaper {
  arxivId: string;
  title: string;
  summary: string;
  categories: string[];
  published: string;
  url: string;
  similarityScore?: number;
}

export interface CitationSnippet {
  page: number;
  text: string;
  score?: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaimEvidence {
  claim: string;
  citations: CitationSnippet[];
}

export interface AnalysisEvidence {
  tldrSummary: CitationSnippet[];
  tldrWhyItMatters: CitationSnippet[];
  tldrTakeaways: ClaimEvidence[];
  explanations: {
    eli15: CitationSnippet[];
    engineer: CitationSnippet[];
    deepTechnical: CitationSnippet[];
  };
}

export type ExtractionSource = 'pdf' | 'ar5iv_html' | 'arxiv_html' | 'metadata_fallback';

export interface AnalysisReliability {
  score: number;
  level: 'High' | 'Medium' | 'Low';
  source: ExtractionSource;
  modelMode: 'model' | 'fallback';
  extractedChars: number;
  evidenceCoverage: number;
  notes: string[];
}

export interface ImplementationArchitectureStep {
  step: string;
  detail: string;
}

export interface ImplementationPlaybook {
  quickStart: string[];
  architectureSteps: ImplementationArchitectureStep[];
  pseudocode: string;
  commonBugs: string[];
  evaluationChecklist: string[];
}

export interface PaperAnalysis {
  metadata: PaperMetadata;
  tldr: TldrData;
  summarySuite: SummarySuite;
  explanations: Explanations;
  concepts: Concept[];
  diagrams: DiagramData[];
  sections: PaperSection[];
  learningPath: LearningPath;
  whyCare: WhyCareData;
  implementationPlaybook: ImplementationPlaybook;
  reliability: AnalysisReliability;
  evidence: AnalysisEvidence;
  similarPapers?: SimilarPaper[];
}

export interface AnalyzeRequest {
  arxivId: string;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: PaperAnalysis;
  error?: string;
}
