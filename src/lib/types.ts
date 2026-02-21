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
}

export interface AnalyzeRequest {
  arxivId: string;
}

export interface AnalyzeResponse {
  success: boolean;
  data?: PaperAnalysis;
  error?: string;
}
