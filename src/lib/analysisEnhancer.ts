import type {
  AnalysisEvidence,
  AnalysisReliability,
  CitationSnippet,
  ExtractionSource,
  PaperAnalysis,
  PaperMetadata,
} from './types';
import { hybridSearchPaper } from './paperRag';

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
}

function queryTerms(claim: string): string[] {
  return cleanText(claim)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 3)
    .slice(0, 18);
}

function scoreSentence(sentence: string, terms: string[]): number {
  if (terms.length === 0) return 0;
  const lower = sentence.toLowerCase();
  let score = 0;
  terms.forEach((term) => {
    if (lower.includes(term)) score += 1;
  });
  return score / terms.length;
}

function sentenceWindow(text: string, claim: string): string {
  const source = cleanText(text)
    .replace(/([A-Za-z])-\s+([A-Za-z])/g, '$1$2')
    .replace(/\[[0-9,\s]+\]/g, '');
  if (!source) return '';

  const sentences = source
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 25);

  if (sentences.length === 0) {
    return source.length > 460 ? `${source.slice(0, 457).trim()}...` : source;
  }

  const terms = queryTerms(claim);
  let bestIdx = 0;
  let bestScore = -1;

  sentences.forEach((sentence, index) => {
    const score = scoreSentence(sentence, terms);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = index;
    }
  });

  const start = Math.max(0, bestIdx - 1);
  const end = Math.min(sentences.length, bestIdx + 2);
  const selected = cleanText(sentences.slice(start, end).join(' '));

  if (selected.length <= 460) return selected;
  const cut = selected.slice(0, 460);
  const safe = cut.slice(0, Math.max(cut.lastIndexOf('. '), cut.lastIndexOf(' ')));
  return `${safe.trim()}...`;
}

function normalizeCitation(snippet: { page: number; text: string; score?: number }, claim: string): CitationSnippet {
  const text = sentenceWindow(snippet.text, claim);
  return {
    page: snippet.page,
    text,
    score: snippet.score,
  };
}

async function citeClaim(params: {
  arxivId: string;
  metadata: PaperMetadata;
  claim: string;
  limit?: number;
}): Promise<CitationSnippet[]> {
  const query = cleanText(params.claim);
  if (!query) return [];

  const results = await hybridSearchPaper({
    arxivId: params.arxivId,
    metadata: params.metadata,
    query: query.slice(0, 320),
    limit: params.limit ?? 2,
  });

  return results
    .filter((item) => item.page > 0 && item.text.trim().length > 0)
    .map((item) => normalizeCitation(item, params.claim))
    .filter((item) => item.text.length > 0)
    .slice(0, params.limit ?? 2);
}

export async function buildEvidenceForAnalysis(params: {
  arxivId: string;
  metadata: PaperMetadata;
  analysis: PaperAnalysis;
}): Promise<{ evidence: AnalysisEvidence; coverage: number; notes: string[] }> {
  const { arxivId, metadata, analysis } = params;
  const takeaways = analysis.tldr.keyTakeaways.slice(0, 4);

  const [
    tldrSummary,
    tldrWhyItMatters,
    eli15,
    engineer,
    deepTechnical,
    ...takeawayEvidence
  ] = await Promise.all([
    citeClaim({ arxivId, metadata, claim: analysis.tldr.summary }),
    citeClaim({ arxivId, metadata, claim: analysis.tldr.whyItMatters }),
    citeClaim({ arxivId, metadata, claim: analysis.explanations.eli15, limit: 2 }),
    citeClaim({ arxivId, metadata, claim: analysis.explanations.engineer, limit: 2 }),
    citeClaim({ arxivId, metadata, claim: analysis.explanations.deepTechnical, limit: 2 }),
    ...takeaways.map((claim) => citeClaim({ arxivId, metadata, claim, limit: 2 })),
  ]);

  const tldrTakeaways = takeaways.map((claim, index) => ({
    claim,
    citations: takeawayEvidence[index] ?? [],
  }));

  const evidence: AnalysisEvidence = {
    tldrSummary,
    tldrWhyItMatters,
    tldrTakeaways,
    explanations: {
      eli15,
      engineer,
      deepTechnical,
    },
  };

  const totalClaims = 2 + 3 + tldrTakeaways.length;
  const coveredClaims =
    (tldrSummary.length > 0 ? 1 : 0) +
    (tldrWhyItMatters.length > 0 ? 1 : 0) +
    (eli15.length > 0 ? 1 : 0) +
    (engineer.length > 0 ? 1 : 0) +
    (deepTechnical.length > 0 ? 1 : 0) +
    tldrTakeaways.filter((item) => item.citations.length > 0).length;

  const coverage = totalClaims > 0 ? Math.round((coveredClaims / totalClaims) * 100) : 0;

  const notes: string[] = [];
  if (coverage < 55) {
    notes.push('Evidence coverage is limited for this paper. Verify claims with direct sections.');
  }
  if (coverage >= 80) {
    notes.push('High evidence alignment across core claims.');
  }

  return { evidence, coverage, notes };
}

function normalizeSourceLabel(source: ExtractionSource): string {
  if (source === 'pdf') return 'PDF';
  if (source === 'ar5iv_html') return 'ar5iv HTML';
  if (source === 'arxiv_html') return 'arXiv HTML';
  return 'Metadata fallback';
}

function cleanDiagnosticLine(line: string): string {
  const raw = cleanText(line);
  if (!raw) return '';

  if (/pdf extraction failed|setting up fake worker|cannot find module|pdf\.worker/i.test(raw)) {
    return 'Primary PDF parser was unavailable in this environment. A stable fallback source was used.';
  }

  if (/pdf text too short/i.test(raw)) {
    return 'Primary PDF text was incomplete, so fallback extraction was applied.';
  }

  if (/using fallback source:\s*ar5iv_html/i.test(raw)) {
    return 'Content extraction used ar5iv HTML fallback for stability.';
  }

  if (/using fallback source:\s*arxiv_html/i.test(raw)) {
    return 'Content extraction used arXiv HTML fallback for stability.';
  }

  if (/metadata\/abstract fallback/i.test(raw)) {
    return 'Only metadata-level content was available; depth may be limited.';
  }

  if (/model fallback reason/i.test(raw)) {
    return 'Model output switched to deterministic fallback to keep analysis available.';
  }

  if (/evidence mapping failed/i.test(raw)) {
    return 'Evidence mapping was limited for some claims.';
  }

  return raw.replace(/\/Users\/[\w./-]+/g, '[local path]').slice(0, 180);
}

export function computeReliability(params: {
  source: ExtractionSource;
  modelMode: 'model' | 'fallback';
  extractedChars: number;
  diagnostics: string[];
  evidenceCoverage: number;
  conceptCount: number;
}): AnalysisReliability {
  const { source, modelMode, extractedChars, diagnostics, evidenceCoverage, conceptCount } = params;

  const baseBySource: Record<ExtractionSource, number> = {
    pdf: 92,
    ar5iv_html: 84,
    arxiv_html: 78,
    metadata_fallback: 58,
  };

  let score = baseBySource[source];

  if (modelMode === 'fallback') score -= 24;
  if (extractedChars < 5000) score -= 12;
  if (extractedChars < 2000) score -= 10;
  if (evidenceCoverage < 70) score -= 9;
  if (evidenceCoverage < 45) score -= 10;
  if (conceptCount < 5) score -= 6;

  score = Math.max(20, Math.min(98, Math.round(score)));

  const level: AnalysisReliability['level'] = score >= 80 ? 'High' : score >= 60 ? 'Medium' : 'Low';

  const detailLines = diagnostics
    .map(cleanDiagnosticLine)
    .filter(Boolean)
    .filter((line, index, arr) => arr.indexOf(line) === index)
    .slice(0, 3);

  const notes = [
    `Text source: ${normalizeSourceLabel(source)}.`,
    modelMode === 'model'
      ? 'Primary model generation completed successfully.'
      : 'Fallback generation mode was used to keep the experience uninterrupted.',
    `Evidence coverage across key claims: ${evidenceCoverage}%.`,
    ...detailLines,
  ]
    .map(cleanText)
    .filter(Boolean);

  return {
    score,
    level,
    source,
    modelMode,
    extractedChars,
    evidenceCoverage,
    notes,
  };
}
