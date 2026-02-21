import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  DifficultyLevel,
  PaperAnalysis,
  PaperMetadata,
  Concept,
  DiagramData,
  PaperSection,
  SummarySuite,
  LearningPath,
  WhyCareData,
} from './types';

const ANALYSIS_PROMPT = `You are PaperLens, an elite AI research learning designer.

Given a research paper, generate a high-value learning experience that helps users deeply understand and retain the paper.

Return ONLY valid JSON (no markdown fences) with this exact shape:
{
  "tldr": {
    "summary": "2-3 sentence plain summary",
    "keyTakeaways": ["5-7 concise takeaways"],
    "whyItMatters": "2-3 sentences",
    "difficulty": "Beginner | Intermediate | Advanced",
    "hook": "One catchy line that makes user want to learn"
  },
  "summarySuite": {
    "ultraShort": "max 1 sentence",
    "oneMinute": "30-60 second explanation",
    "fiveMinute": "5 minute walkthrough summary",
    "detailed": "dense but clear summary",
    "revisionQuestions": ["4-6 self-test questions"],
    "actionChecklist": ["4-6 concrete learning actions"]
  },
  "explanations": {
    "eli15": "Story + analogy driven explanation",
    "engineer": "Implementation and systems perspective",
    "deepTechnical": "Math, assumptions, novelty, limits"
  },
  "concepts": [
    {
      "name": "Concept name",
      "intuition": "Why this concept exists in simple terms",
      "technicalDefinition": "Precise technical explanation",
      "whyImportant": "How it contributes to the paper",
      "analogy": "Memorable real-world analogy",
      "prerequisites": ["3-5 prerequisite ideas"],
      "pitfalls": ["2-4 common misunderstandings"],
      "takeaway": "What to remember forever",
      "miniQuiz": {
        "question": "One strong question",
        "answer": "Direct answer"
      },
      "diagram": "Optional Mermaid code for this concept"
    }
  ],
  "sections": [
    {
      "title": "Section title",
      "simplified": "Friendly but accurate rewrite",
      "keyPoints": ["2-4 key points"]
    }
  ],
  "learningPath": {
    "totalMinutes": 45,
    "strategy": "How to study this paper effectively",
    "steps": [
      {
        "stepTitle": "Step name",
        "goal": "Goal of this step",
        "estimatedMinutes": 8,
        "output": "What user should produce/know"
      }
    ]
  },
  "whyCare": {
    "realWorldImpact": "How this changes real systems",
    "useCases": ["3-6 practical use-cases"],
    "companiesUsing": ["Known companies or labs"],
    "whyItsCool": "What makes it exciting"
  }
}

Rules:
1. Concepts: produce 6-10 strong concept cards.
2. Keep jargon low in summaries, high precision in deep section.
3. Focus on actionable learning value and retention.
4. Avoid backslashes in normal prose text.
5. No filler text.
6. Never output placeholder text like "no content provided" or "cannot be determined".
7. If source text is limited, still produce the best possible concrete learning breakdown.

PAPER TEXT:
`;

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean);
}

const PLACEHOLDER_PATTERNS = [
  /no paper content/i,
  /content was provided/i,
  /summary cannot be generated/i,
  /please provide (?:the )?(?:full )?text/i,
  /unable to extract/i,
  /cannot be determined/i,
  /content is missing/i,
];

function hasPlaceholderLanguage(value: string): boolean {
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value));
}

function cleanNarrative(value: unknown, fallback = ''): string {
  const text = asString(value).replace(/\s+/g, ' ').trim();
  if (!text) return fallback;
  return hasPlaceholderLanguage(text) ? fallback : text;
}

function cleanNarrativeArray(value: unknown, fallback: string[]): string[] {
  const cleaned = asStringArray(value)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length > 0 && !hasPlaceholderLanguage(item));
  return cleaned.length > 0 ? cleaned : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeDifficulty(value: unknown): DifficultyLevel {
  const normalized = asString(value).toLowerCase();
  if (normalized === 'beginner') return 'Beginner';
  if (normalized === 'advanced') return 'Advanced';
  return 'Intermediate';
}

function parseJsonPayload(raw: string): Record<string, unknown> {
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const match = cleaned.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  return JSON.parse(cleaned);
}

function extractJsonObject(text: string): string {
  const source = text.trim();
  const start = source.indexOf('{');
  if (start === -1) return source;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;

    if (depth === 0) {
      return source.slice(start, i + 1);
    }
  }

  return source.slice(start);
}

function escapeInvalidBackslashes(text: string): string {
  let out = '';
  let inString = false;
  let escaped = false;
  const validEscapeChars = new Set(['"', '\\', '/', 'b', 'f', 'n', 'r', 't', 'u']);

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (!inString) {
      out += char;
      if (char === '"') inString = true;
      continue;
    }

    if (escaped) {
      out += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      const next = text[i + 1];
      if (next && validEscapeChars.has(next)) {
        out += '\\';
      } else {
        out += '\\\\';
      }
      escaped = true;
      continue;
    }

    out += char;
    if (char === '"') inString = false;
  }

  return out;
}

async function parseJsonPayloadWithRepair(
  raw: string,
  regenerate: (prompt: string) => Promise<string>
): Promise<Record<string, unknown>> {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const extracted = extractJsonObject(cleaned);
  const repairedEscapes = escapeInvalidBackslashes(extracted);
  const candidates = [cleaned, extracted, repairedEscapes];

  for (const candidate of candidates) {
    try {
      return parseJsonPayload(candidate);
    } catch {
      // Try next parse strategy.
    }
  }

  const repairPrompt = `Fix this malformed JSON into valid JSON.\nReturn ONLY JSON.\n\n${extracted}`;
  const repairedFromModel = await regenerate(repairPrompt);
  const repaired = extractJsonObject(repairedFromModel);
  return parseJsonPayload(escapeInvalidBackslashes(repaired));
}

function ensureMinimumContent<T>(items: T[], fallbackItems: T[]): T[] {
  return items.length > 0 ? items : fallbackItems;
}

function normalizeConcepts(rawConcepts: unknown): Concept[] {
  if (!Array.isArray(rawConcepts)) return [];

  return rawConcepts.slice(0, 10).map((concept, index) => {
    const base = (concept ?? {}) as Record<string, unknown>;
    const name = cleanNarrative(base.name, `Concept ${index + 1}`);
    const intuition = cleanNarrative(base.intuition, cleanNarrative(base.explanation, 'Core intuition.'));
    const technicalDefinition = cleanNarrative(base.technicalDefinition, intuition);
    const whyImportant = cleanNarrative(base.whyImportant, cleanNarrative(base.whyItMatters, intuition));
    const analogy = cleanNarrative(base.analogy, 'Think of it as a system component with a clear job.');
    const prerequisites = cleanNarrativeArray(base.prerequisites, ['Basic ML concepts']);
    const pitfalls = cleanNarrativeArray(base.pitfalls, ['Skipping assumptions behind the method']);
    const takeaway = cleanNarrative(base.takeaway, whyImportant || intuition);
    const miniQuizRaw = (base.miniQuiz ?? {}) as Record<string, unknown>;

    return {
      name,
      intuition,
      technicalDefinition,
      whyImportant,
      analogy,
      prerequisites,
      pitfalls,
      takeaway,
      miniQuiz: {
        question: cleanNarrative(miniQuizRaw.question, `What is the core idea behind ${name}?`),
        answer: cleanNarrative(miniQuizRaw.answer, takeaway || intuition),
      },
      diagram: cleanNarrative(base.diagram),
    };
  });
}

function normalizeSections(rawSections: unknown): PaperSection[] {
  if (!Array.isArray(rawSections)) return [];

  return rawSections
    .map((section, index) => {
      const base = (section ?? {}) as Record<string, unknown>;
      return {
        title: cleanNarrative(base.title, `Section ${index + 1}`),
        simplified: cleanNarrative(base.simplified, cleanNarrative(base.content)),
        keyPoints: cleanNarrativeArray(base.keyPoints, []),
      };
    })
    .filter((section) => section.simplified.length > 0);
}

function normalizeSummarySuite(raw: unknown, fallbackSummary: string): SummarySuite {
  const base = (raw ?? {}) as Record<string, unknown>;
  return {
    ultraShort: cleanNarrative(base.ultraShort, fallbackSummary),
    oneMinute: cleanNarrative(base.oneMinute, fallbackSummary),
    fiveMinute: cleanNarrative(base.fiveMinute, fallbackSummary),
    detailed: cleanNarrative(base.detailed, fallbackSummary),
    revisionQuestions: cleanNarrativeArray(base.revisionQuestions, []),
    actionChecklist: cleanNarrativeArray(base.actionChecklist, []),
  };
}

function normalizeWhyCare(raw: unknown): WhyCareData {
  const base = (raw ?? {}) as Record<string, unknown>;
  return {
    realWorldImpact: cleanNarrative(base.realWorldImpact),
    useCases: cleanNarrativeArray(base.useCases, []),
    companiesUsing: cleanNarrativeArray(base.companiesUsing, []),
    whyItsCool: cleanNarrative(base.whyItsCool),
  };
}

function normalizeLearningPath(raw: unknown, fallbackSections: PaperSection[]): LearningPath {
  const base = (raw ?? {}) as Record<string, unknown>;
  const rawSteps = Array.isArray(base.steps) ? base.steps : [];

  const steps = rawSteps
    .map((step, index) => {
      const item = (step ?? {}) as Record<string, unknown>;
      return {
        stepTitle: cleanNarrative(item.stepTitle, `Step ${index + 1}`),
        goal: cleanNarrative(item.goal),
        estimatedMinutes: asNumber(item.estimatedMinutes, 8),
        output: cleanNarrative(item.output, 'Capture one clear takeaway from this step.'),
      };
    })
    .filter((step) => step.goal.length > 0);

  if (steps.length > 0) {
    return {
      totalMinutes: asNumber(
        base.totalMinutes,
        steps.reduce((sum, step) => sum + step.estimatedMinutes, 0)
      ),
      strategy: cleanNarrative(
        base.strategy,
        'Learn in layers: intuition first, implementation second, deep details last.'
      ),
      steps,
    };
  }

  const derivedSteps = fallbackSections.slice(0, 5).map((section, index) => ({
    stepTitle: section.title,
    goal: `Understand ${section.title.toLowerCase()} clearly.`,
    estimatedMinutes: 8 + index,
    output: section.keyPoints[0] ?? `A short note summarizing ${section.title}.`,
  }));

  return {
    totalMinutes: derivedSteps.reduce((sum, step) => sum + step.estimatedMinutes, 0),
    strategy: 'Follow the sequence from overview to method to impact.',
    steps: derivedSteps,
  };
}

function sanitizeLabel(text: string, fallback: string): string {
  const normalized = asString(text, fallback)
    .replace(/[\[\]{}()"'`<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return (normalized || fallback).slice(0, 42);
}

function buildGuaranteedDiagrams(
  metadata: PaperMetadata,
  concepts: Concept[],
  sections: PaperSection[],
  whyCare: WhyCareData
): DiagramData[] {
  const paper = sanitizeLabel(metadata.title, 'Research Paper');

  const topConcepts = ensureMinimumContent(
    concepts.slice(0, 5).map((concept, index) => ({
      id: `C${index + 1}`,
      label: sanitizeLabel(concept.name, `Concept ${index + 1}`),
    })),
    [
      { id: 'C1', label: 'Core Problem' },
      { id: 'C2', label: 'Method Idea' },
      { id: 'C3', label: 'Key Mechanism' },
      { id: 'C4', label: 'Main Result' },
    ]
  );

  const sectionNodes = ensureMinimumContent(
    sections.slice(0, 6).map((section, index) => ({
      id: `S${index + 1}`,
      label: sanitizeLabel(section.title, `Section ${index + 1}`),
    })),
    [
      { id: 'S1', label: 'Overview' },
      { id: 'S2', label: 'Problem' },
      { id: 'S3', label: 'Method' },
      { id: 'S4', label: 'Results' },
      { id: 'S5', label: 'Limitations' },
    ]
  );

  const useCaseNodes = whyCare.useCases.slice(0, 3).map((useCase, index) => ({
    id: `U${index + 1}`,
    label: sanitizeLabel(useCase, `Use Case ${index + 1}`),
  }));

  const companyNodes = whyCare.companiesUsing.slice(0, 3).map((company, index) => ({
    id: `K${index + 1}`,
    label: sanitizeLabel(company, `Company ${index + 1}`),
  }));

  const conceptMap = [
    'graph LR',
    `P["${paper}"]`,
    ...topConcepts.map((concept) => `${concept.id}["${concept.label}"]`),
    ...topConcepts.map((concept) => `P --> ${concept.id}`),
  ].join('\n');

  const pipelineTitles = sectionNodes.slice(0, 4);
  const pipelineMap = [
    'graph TD',
    ...pipelineTitles.map((section) => `${section.id}["${section.label}"]`),
    ...pipelineTitles
      .slice(0, -1)
      .map((section, index) => `${section.id} --> ${pipelineTitles[index + 1].id}`),
  ].join('\n');

  const sectionMap = [
    'graph TD',
    'P["Paper Structure"]',
    ...sectionNodes.map((section) => `${section.id}["${section.label}"]`),
    ...sectionNodes.map((section) => `P --> ${section.id}`),
  ].join('\n');

  const impactNodes = useCaseNodes.length > 0 ? useCaseNodes : [{ id: 'U1', label: 'Practical Applications' }];
  const companies = companyNodes.length > 0 ? companyNodes : [{ id: 'K1', label: 'Industry Teams' }];

  const impactMap = [
    'graph LR',
    'P["Research Impact"]',
    ...impactNodes.map((node) => `${node.id}["${node.label}"]`),
    ...companies.map((node) => `${node.id}["${node.label}"]`),
    ...impactNodes.map((node) => `P --> ${node.id}`),
    ...companies.map((node) => `P --> ${node.id}`),
  ].join('\n');

  return [
    {
      title: 'Core Concept Map',
      description: 'How the most important concepts connect to the paper.',
      code: conceptMap,
    },
    {
      title: 'Method Flow',
      description: 'A linear view of how the paper progresses from problem to outcome.',
      code: pipelineMap,
    },
    {
      title: 'Paper Structure',
      description: 'Major sections and how they fit together.',
      code: sectionMap,
    },
    {
      title: 'Impact Network',
      description: 'Practical use cases and organizations that can benefit from this work.',
      code: impactMap,
    },
  ];
}

function defaultConcepts(): Concept[] {
  return [
    {
      name: 'Core Research Objective',
      intuition: 'The central question this paper is trying to answer.',
      technicalDefinition: 'A precise statement of the target hypothesis, capability, or optimization objective.',
      whyImportant: 'Everything in the paper is designed to improve this objective.',
      analogy: 'Like defining the exact destination before choosing a route.',
      prerequisites: ['Problem framing', 'Baseline methods'],
      pitfalls: ['Confusing objective with implementation detail'],
      takeaway: 'Always anchor the paper to its core objective first.',
      miniQuiz: {
        question: 'What is the exact problem this paper solves?',
        answer: 'The paper focuses on a specific measurable research objective.',
      },
      diagram: '',
    },
    {
      name: 'Method Architecture',
      intuition: 'How the proposed approach is organized end-to-end.',
      technicalDefinition: 'The composition of modules and data transformations used by the method.',
      whyImportant: 'Architecture determines capability, cost, and behavior.',
      analogy: 'Like blueprints that define how a building stands.',
      prerequisites: ['Model components', 'Data flow basics'],
      pitfalls: ['Assuming architecture without reading method section'],
      takeaway: 'Understand the full pipeline before evaluating results.',
      miniQuiz: {
        question: 'Which modules form the method pipeline?',
        answer: 'The method combines components in a structured architecture.',
      },
      diagram: '',
    },
  ];
}

function defaultSections(metadata: PaperMetadata): PaperSection[] {
  return [
    {
      title: 'Overview',
      simplified: `This work titled "${metadata.title}" introduces a focused solution to a meaningful research problem.`,
      keyPoints: ['Defines a clear objective', 'Positions contribution against prior work'],
    },
    {
      title: 'Method',
      simplified: 'The paper proposes a method pipeline and explains why each part improves performance.',
      keyPoints: ['Pipeline structure', 'Design rationale'],
    },
    {
      title: 'Results',
      simplified: 'Experiments demonstrate the method’s strengths and reveal practical trade-offs.',
      keyPoints: ['Quantitative gains', 'Observed limitations'],
    },
  ];
}

function defaultSummarySuite(summary: string): SummarySuite {
  return {
    ultraShort: summary || 'A focused research contribution solving a concrete technical problem.',
    oneMinute: summary || 'This paper introduces a method, validates it experimentally, and explains why it matters.',
    fiveMinute: summary || 'The work proposes a method, compares against baselines, and discusses impact and limitations.',
    detailed: summary || 'Detailed summary is not available; use the explanations and section breakdown below.',
    revisionQuestions: [
      'What core problem does this paper solve?',
      'What is novel in the method?',
      'Which experiment best supports the claim?',
    ],
    actionChecklist: [
      'Read TL;DR and one-minute summary first',
      'Study method diagram and section breakdown',
      'Answer revision questions without looking',
    ],
  };
}

function defaultWhyCare(): WhyCareData {
  return {
    realWorldImpact: 'This research can improve how real systems perform and make decisions.',
    useCases: ['Model design', 'Evaluation workflows', 'Applied system improvements'],
    companiesUsing: ['Research labs', 'AI product teams'],
    whyItsCool: 'It turns a hard research challenge into a more practical and scalable approach.',
  };
}

function normalizeExplanations(raw: unknown, summary: string): {
  eli15: string;
  engineer: string;
  deepTechnical: string;
} {
  const base = (raw ?? {}) as Record<string, unknown>;
  const fallback = summary || 'Explanation unavailable. Please retry analysis.';
  return {
    eli15: cleanNarrative(base.eli15, fallback),
    engineer: cleanNarrative(base.engineer, fallback),
    deepTechnical: cleanNarrative(base.deepTechnical, fallback),
  };
}

function buildSafeAnalysis(parsed: Record<string, unknown>, metadata: PaperMetadata): PaperAnalysis {
  const tldrRaw = (parsed.tldr ?? {}) as Record<string, unknown>;
  const fallbackSummary =
    cleanNarrative(metadata.abstract) ||
    `This paper, "${metadata.title}", proposes a concrete method and evaluates it experimentally.`;
  const tldr = {
    summary: cleanNarrative(tldrRaw.summary, fallbackSummary),
    keyTakeaways: ensureMinimumContent(cleanNarrativeArray(tldrRaw.keyTakeaways, []), [
      'Defines a clear research goal.',
      'Introduces a concrete method.',
      'Evaluates performance with experiments.',
      'Discusses trade-offs and limitations.',
      'Highlights practical implications.',
    ]),
    whyItMatters: cleanNarrative(
      tldrRaw.whyItMatters,
      'The paper contributes a method that can improve how similar problems are solved.'
    ),
    difficulty: normalizeDifficulty(tldrRaw.difficulty),
    hook: cleanNarrative(tldrRaw.hook, 'Understand the key idea quickly, then go deep.'),
  };

  const concepts = ensureMinimumContent(normalizeConcepts(parsed.concepts), defaultConcepts());
  const sections = ensureMinimumContent(normalizeSections(parsed.sections), defaultSections(metadata));
  const whyCareCandidate = normalizeWhyCare(parsed.whyCare);
  const whyCare =
    whyCareCandidate.useCases.length > 0 || whyCareCandidate.realWorldImpact
      ? whyCareCandidate
      : defaultWhyCare();

  const summarySuiteCandidate = normalizeSummarySuite(parsed.summarySuite, tldr.summary);
  const summarySuite =
    summarySuiteCandidate.ultraShort || summarySuiteCandidate.oneMinute
      ? summarySuiteCandidate
      : defaultSummarySuite(tldr.summary);

  return {
    metadata,
    tldr,
    summarySuite,
    explanations: normalizeExplanations(parsed.explanations, tldr.summary),
    concepts,
    diagrams: buildGuaranteedDiagrams(metadata, concepts, sections, whyCare),
    sections,
    learningPath: normalizeLearningPath(parsed.learningPath, sections),
    whyCare,
  };
}

function parsedHasPlaceholderContent(parsed: Record<string, unknown>): boolean {
  const asText = JSON.stringify(parsed);
  return hasPlaceholderLanguage(asText);
}

export async function analyzePaper(
  paperText: string,
  metadata: PaperMetadata,
  apiKey: string
): Promise<PaperAnalysis> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  const normalizedPaperText = paperText.trim();
  const paperBody = normalizedPaperText.slice(0, 90000);
  const contentMode = paperBody.length >= 1400 ? 'full_text' : 'limited_text';
  const abstractFallback = cleanNarrative(metadata.abstract, 'Abstract not available.');

  const contextPrefix = `
PAPER TITLE: ${metadata.title}
AUTHORS: ${metadata.authors.join(', ')}
ABSTRACT: ${abstractFallback}
CATEGORIES: ${metadata.categories.join(', ')}
CONTENT_MODE: ${contentMode}

FULL PAPER TEXT:
`;

  const fullPrompt =
    ANALYSIS_PROMPT +
    `\nAdditional instruction: Do not mention missing content. Build concrete explanations from available evidence.\n` +
    contextPrefix +
    paperBody;

  const firstResponse = await model.generateContent(fullPrompt);
  const firstText = firstResponse.response.text();

  let parsed = await parseJsonPayloadWithRepair(firstText, async (prompt) => {
    const repairResponse = await model.generateContent(prompt);
    return repairResponse.response.text();
  });

  if (parsedHasPlaceholderContent(parsed)) {
    const retryPrompt =
      ANALYSIS_PROMPT +
      `\nThe prior output contained placeholder language. Regenerate with concrete educational value and zero placeholders.\n` +
      contextPrefix +
      paperBody;
    const retryResponse = await model.generateContent(retryPrompt);
    const retryText = retryResponse.response.text();
    const repairedRetry = await parseJsonPayloadWithRepair(retryText, async (prompt) => {
      const repairResponse = await model.generateContent(prompt);
      return repairResponse.response.text();
    });

    if (!parsedHasPlaceholderContent(repairedRetry)) {
      parsed = repairedRetry;
    }
  }

  return buildSafeAnalysis(parsed, metadata);
}
