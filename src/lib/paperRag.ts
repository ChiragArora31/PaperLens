import { GoogleGenerativeAI } from '@google/generative-ai';
import { fetchArxivMetadata, fetchArxivPaperText } from './arxiv';
import type { ChatMessage, CitationSnippet, PaperMetadata } from './types';

const FETCH_TIMEOUT_MS = 30000;
const ARXIV_USER_AGENT = 'PaperLens/1.0';
const MAX_CHUNK_CHARS = 900;
const CHUNK_OVERLAP_CHARS = 130;

interface PaperPage {
  page: number;
  text: string;
}

interface PaperChunk {
  id: string;
  page: number;
  text: string;
  tokens: string[];
}

export interface HybridSearchResult extends CitationSnippet {
  chunkId: string;
  semanticScore?: number;
  lexicalScore?: number;
}

interface SemanticScore {
  id: string;
  score: number;
}

const pageCache = new Map<string, Promise<PaperPage[]>>();

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanString(value: string): string {
  return normalizeWhitespace(value.replace(/\u0000/g, ' '));
}

function tokenize(value: string): string[] {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 300);
}

function hasMeaningfulText(value: string): boolean {
  const text = cleanString(value);
  if (!text) return false;
  const alphaCount = (text.match(/[A-Za-z]/g) ?? []).length;
  return text.length >= 200 && alphaCount >= 80;
}

function normalizeArxivId(arxivId: string): string {
  return arxivId.trim().replace(/^arxiv:\s*/i, '').replace(/\/+$/, '').replace(/\.pdf$/i, '');
}

function extractJsonObject(source: string): string {
  const text = source.trim();
  const start = text.indexOf('{');
  if (start < 0) return text;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
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
    if (depth === 0) return text.slice(start, i + 1);
  }

  return text.slice(start);
}

function parseLooseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Try extracted object fallback.
  }

  try {
    return JSON.parse(extractJsonObject(raw)) as T;
  } catch {
    return null;
  }
}

function splitLongText(value: string, maxChars: number, overlapChars: number): string[] {
  const text = cleanString(value);
  if (text.length <= maxChars) return [text];

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = Math.min(start + maxChars, text.length);
    if (end < text.length) {
      const breakAt =
        text.lastIndexOf('. ', end) > start + 200
          ? text.lastIndexOf('. ', end) + 1
          : text.lastIndexOf(' ', end);
      if (breakAt > start + 120) end = breakAt;
    }

    const slice = cleanString(text.slice(start, end));
    if (slice) chunks.push(slice);
    if (end >= text.length) break;

    start = Math.max(end - overlapChars, start + 1);
  }

  return chunks;
}

function overlapScore(queryTokens: string[], candidateTokens: string[]): number {
  if (queryTokens.length === 0 || candidateTokens.length === 0) return 0;

  const querySet = new Set(queryTokens);
  let hitCount = 0;
  let weightedHits = 0;

  candidateTokens.forEach((token, index) => {
    if (!querySet.has(token)) return;
    hitCount += 1;
    weightedHits += 1 / (1 + index * 0.02);
  });

  const recall = hitCount / querySet.size;
  const precision = hitCount / Math.max(candidateTokens.length, 1);
  const density = weightedHits / Math.max(querySet.size, 1);

  return recall * 0.62 + precision * 2.6 + density * 0.24;
}

async function fetchPdfBuffer(arxivId: string): Promise<ArrayBuffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const url = `https://arxiv.org/pdf/${encodeURIComponent(arxivId)}.pdf`;
    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/pdf,*/*;q=0.8',
        'User-Agent': ARXIV_USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Unable to fetch PDF (${response.status}).`);
    }

    return response.arrayBuffer();
  } finally {
    clearTimeout(timeout);
  }
}

async function parsePdfPagesFromBuffer(buffer: ArrayBuffer): Promise<PaperPage[]> {
  const pdfModule = (await import('pdf-parse')) as unknown as {
    PDFParse?: new (options: { data: Uint8Array }) => {
      getText: (
        options?: unknown
      ) => Promise<{ text?: string; pages?: Array<{ text?: string; num?: number; pageNumber?: number }> }>;
      destroy?: () => Promise<void>;
    };
    default?: (data: Buffer | Uint8Array) => Promise<{ text?: string }>;
  };

  const data = new Uint8Array(buffer);
  const pages: PaperPage[] = [];

  if (typeof pdfModule.PDFParse === 'function') {
    const parser = new pdfModule.PDFParse({ data });
    try {
      const result = await parser.getText();
      const resultPages = Array.isArray(result.pages) ? result.pages : [];

      if (resultPages.length > 0) {
        resultPages.forEach((entry, index) => {
          const text = cleanString(entry?.text ?? '');
          if (!hasMeaningfulText(text)) return;
          pages.push({
            page: entry?.num ?? entry?.pageNumber ?? index + 1,
            text,
          });
        });
      }

      if (pages.length === 0 && result.text) {
        const fallbackPages = result.text.split('\f');
        fallbackPages.forEach((part, index) => {
          const text = cleanString(part);
          if (!hasMeaningfulText(text)) return;
          pages.push({ page: index + 1, text });
        });
      }
    } finally {
      if (parser.destroy) await parser.destroy();
    }
  }

  if (pages.length === 0 && typeof pdfModule.default === 'function') {
    const fallback = await pdfModule.default(Buffer.from(buffer));
    const raw = typeof fallback.text === 'string' ? fallback.text : '';
    const parts = raw.split('\f');
    parts.forEach((text, index) => {
      const cleaned = cleanString(text);
      if (!hasMeaningfulText(cleaned)) return;
      pages.push({ page: index + 1, text: cleaned });
    });
  }

  if (pages.length === 0) {
    throw new Error('Could not extract page text from PDF.');
  }

  return pages.slice(0, 120);
}

async function loadPaperPages(arxivId: string, metadata?: PaperMetadata): Promise<PaperPage[]> {
  const normalizedId = normalizeArxivId(arxivId);
  const cacheKey = normalizedId;

  if (!pageCache.has(cacheKey)) {
    pageCache.set(
      cacheKey,
      (async () => {
        try {
          const buffer = await fetchPdfBuffer(normalizedId);
          const pages = await parsePdfPagesFromBuffer(buffer);
          if (pages.length > 0) return pages;
        } catch {
          // Fallback to the existing robust paper extraction.
        }

        const resolvedMetadata = metadata ?? (await fetchArxivMetadata(normalizedId));
        const paperText = await fetchArxivPaperText(normalizedId, resolvedMetadata);
        const fallback = splitLongText(paperText.text, 1800, 220).map((text, index) => ({
          page: index + 1,
          text,
        }));

        return fallback.length > 0
          ? fallback
          : [{ page: 1, text: `${resolvedMetadata.title}. ${resolvedMetadata.abstract}`.trim() }];
      })()
    );
  }

  return pageCache.get(cacheKey) as Promise<PaperPage[]>;
}

function buildChunks(pages: PaperPage[]): PaperChunk[] {
  const chunks: PaperChunk[] = [];
  pages.forEach((page) => {
    const segments = splitLongText(page.text, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS);
    segments.forEach((segment, index) => {
      const text = cleanString(segment);
      if (!hasMeaningfulText(text)) return;
      chunks.push({
        id: `p${page.page}-${index + 1}`,
        page: page.page,
        text,
        tokens: tokenize(text),
      });
    });
  });

  return chunks;
}

async function semanticRerank(
  query: string,
  candidates: PaperChunk[],
  apiKey?: string
): Promise<Map<string, number>> {
  const scores = new Map<string, number>();
  if (!apiKey || candidates.length === 0) return scores;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });

  const candidatePayload = candidates.map((candidate) => ({
    id: candidate.id,
    page: candidate.page,
    text: candidate.text.slice(0, 520),
  }));

  const prompt = `Score these snippets for conceptual relevance to the question.
Return JSON only:
{"scores":[{"id":"snippet-id","score":0.0}]}
Rules:
1) Score between 0 and 1.
2) Prefer snippets that answer intent, not only token overlap.
3) Penalize unrelated snippets hard.

Question: ${query}
Snippets:
${JSON.stringify(candidatePayload)}`;

  try {
    const response = await model.generateContent(prompt);
    const parsed = parseLooseJson<{ scores?: SemanticScore[] }>(response.response.text());
    if (!parsed?.scores) return scores;

    parsed.scores.forEach((item) => {
      if (!item || typeof item.id !== 'string') return;
      const numeric = Number(item.score);
      if (!Number.isFinite(numeric)) return;
      scores.set(item.id, Math.max(0, Math.min(1, numeric)));
    });
  } catch {
    // Ignore semantic rerank failures. Lexical rank still works.
  }

  return scores;
}

export async function hybridSearchPaper(params: {
  arxivId: string;
  metadata?: PaperMetadata;
  query: string;
  limit?: number;
  apiKey?: string;
}): Promise<HybridSearchResult[]> {
  const query = cleanString(params.query);
  if (!query) return [];

  const pages = await loadPaperPages(params.arxivId, params.metadata);
  const chunks = buildChunks(pages);
  if (chunks.length === 0) return [];

  const queryTokens = tokenize(query);
  const lexicalRanked = chunks
    .map((chunk) => ({
      chunk,
      lexicalScore: overlapScore(queryTokens, chunk.tokens),
    }))
    .sort((a, b) => b.lexicalScore - a.lexicalScore)
    .slice(0, 16);

  const semanticScores = await semanticRerank(
    query,
    lexicalRanked.map((item) => item.chunk),
    params.apiKey
  );

  const ranked = lexicalRanked
    .map((item) => {
      const semanticScore = semanticScores.get(item.chunk.id) ?? 0;
      const score = item.lexicalScore * 0.58 + semanticScore * 0.42;
      return {
        chunkId: item.chunk.id,
        page: item.chunk.page,
        text: item.chunk.text,
        lexicalScore: Number(item.lexicalScore.toFixed(4)),
        semanticScore: Number(semanticScore.toFixed(4)),
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, params.limit ?? 6));

  return ranked.map((item) => ({
    chunkId: item.chunkId,
    page: item.page,
    text: item.text,
    score: Number(item.score.toFixed(4)),
    lexicalScore: item.lexicalScore,
    semanticScore: item.semanticScore,
  }));
}

function buildConversationHistory(history: ChatMessage[]): string {
  return history
    .slice(-8)
    .map((message) => `${message.role.toUpperCase()}: ${cleanString(message.content)}`)
    .join('\n');
}

export async function answerQuestionWithCitations(params: {
  arxivId: string;
  metadata?: PaperMetadata;
  question: string;
  history?: ChatMessage[];
  apiKey: string;
}): Promise<{
  answer: string;
  citations: CitationSnippet[];
  evidence: HybridSearchResult[];
}> {
  const question = cleanString(params.question);
  if (!question) {
    return {
      answer: 'Please ask a specific question about the paper.',
      citations: [],
      evidence: [],
    };
  }

  const evidence = await hybridSearchPaper({
    arxivId: params.arxivId,
    metadata: params.metadata,
    query: question,
    limit: 7,
    apiKey: params.apiKey,
  });

  if (evidence.length === 0) {
    return {
      answer: 'I could not find strong evidence in this paper for that question. Try a more specific prompt.',
      citations: [],
      evidence: [],
    };
  }

  const genAI = new GoogleGenerativeAI(params.apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.15,
    },
  });

  const context = evidence
    .map(
      (chunk, index) =>
        `SOURCE_${index + 1} | PAGE_${chunk.page} | SCORE_${chunk.score}\n${chunk.text.slice(0, 850)}`
    )
    .join('\n\n');

  const prompt = `You are PaperLens. Answer using only the supplied paper evidence.
Return JSON only with this shape:
{
  "answer": "clear concise answer",
  "citations": [
    { "page": 3, "text": "short quote or paraphrase grounded in source" }
  ]
}

Rules:
1) If evidence is uncertain, explicitly say uncertainty.
2) Keep answer technical but clear.
3) 2 to 4 citations preferred.
4) Each citation page must be from provided sources.

Question: ${question}

Conversation history:
${buildConversationHistory(params.history ?? []) || 'No prior messages.'}

Evidence:
${context}`;

  let answer = '';
  let citations: CitationSnippet[] = [];

  try {
    const response = await model.generateContent(prompt);
    const parsed = parseLooseJson<{ answer?: string; citations?: CitationSnippet[] }>(
      response.response.text()
    );
    answer = cleanString(parsed?.answer ?? '');
    citations = Array.isArray(parsed?.citations)
      ? parsed.citations
          .map((item) => ({
            page: Number(item.page),
            text: cleanString(item.text ?? ''),
          }))
          .filter(
            (item) =>
              Number.isFinite(item.page) &&
              item.page > 0 &&
              item.text.length > 0 &&
              evidence.some((source) => source.page === item.page)
          )
      : [];
  } catch {
    // Fallback handled below.
  }

  if (!answer) {
    answer = `Here is what the paper evidence indicates: ${evidence
      .slice(0, 2)
      .map((item) => item.text.slice(0, 180))
      .join(' ')}`;
  }

  if (citations.length === 0) {
    citations = evidence.slice(0, 3).map((item) => ({
      page: item.page,
      text: item.text.slice(0, 220),
      score: item.score,
    }));
  }

  return { answer, citations, evidence };
}
