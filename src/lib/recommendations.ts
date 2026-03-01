import { PaperMetadata, SimilarPaper } from './types';
import { cleanString } from './userPaper';

export interface RecommendedPaper {
  arxivId: string;
  title: string;
  summary: string;
  published: string;
  categories: string[];
  url: string;
}

const ARXIV_TIMEOUT_MS = 15000;
const DEFAULT_CATEGORIES = ['cs.AI', 'cs.LG'];
const QUERY_CACHE_TTL_MS = 1000 * 60 * 12;

const queryCache = new Map<string, { expiresAt: number; data: RecommendedPaper[] }>();
const inFlightQuery = new Map<string, Promise<RecommendedPaper[]>>();

function extractFirstTag(source: string, pattern: string): string {
  const match = source.match(new RegExp(`<${pattern}[^>]*>([\\s\\S]*?)<\\/${pattern}>`, 'i'));
  return cleanString((match?.[1] ?? '').replace(/<[^>]+>/g, ' '));
}

function normalizeArxivId(value: string): string {
  return cleanString(value)
    .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '')
    .replace(/\.pdf$/i, '')
    .replace(/v\d+$/i, '');
}

function tokenize(value: string): string[] {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 120);
}

function jaccardScore(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;

  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function parseEntries(feed: string): RecommendedPaper[] {
  const entries = feed.match(/<(?:\w+:)?entry>[\s\S]*?<\/(?:\w+:)?entry>/gi) ?? [];

  return entries
    .map((entry) => {
      const idRaw = extractFirstTag(entry, '(?:\\w+:)?id');
      const arxivId = normalizeArxivId(idRaw);
      const title = extractFirstTag(entry, '(?:\\w+:)?title');
      const summary = extractFirstTag(entry, '(?:\\w+:)?summary');
      const published = extractFirstTag(entry, '(?:\\w+:)?published');
      const categories = Array.from(
        entry.matchAll(/<(?:\\w+:)?category[^>]*term=["']([^"']+)["'][^>]*\/?\s*>/gi),
        (match) => cleanString(match[1] ?? '')
      ).filter(Boolean);

      return {
        arxivId,
        title,
        summary,
        published,
        categories,
        url: arxivId ? `https://arxiv.org/abs/${arxivId}` : '',
      };
    })
    .filter((paper) => paper.arxivId && paper.title);
}

async function fetchArxivByQueryUncached(
  searchQuery: string,
  maxResults = 24
): Promise<RecommendedPaper[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARXIV_TIMEOUT_MS);

  try {
    const url =
      `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}` +
      `&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

    const response = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        Accept: 'application/atom+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'PaperLens/1.0',
      },
    });

    if (!response.ok) return [];
    const feed = await response.text();
    return parseEntries(feed);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchArxivByQuery(searchQuery: string, maxResults = 24): Promise<RecommendedPaper[]> {
  const key = `${searchQuery}::${maxResults}`;
  const now = Date.now();

  const cached = queryCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  const pending = inFlightQuery.get(key);
  if (pending) return pending;

  const promise = fetchArxivByQueryUncached(searchQuery, maxResults)
    .then((data) => {
      queryCache.set(key, {
        expiresAt: Date.now() + QUERY_CACHE_TTL_MS,
        data,
      });
      return data;
    })
    .finally(() => {
      inFlightQuery.delete(key);
    });

  inFlightQuery.set(key, promise);
  return promise;
}

export async function fetchRecommendedPapers(
  seedCategories: string[],
  excludeArxivIds: string[],
  limit = 8
): Promise<RecommendedPaper[]> {
  const categoryPool = Array.from(
    new Set(seedCategories.map((value) => cleanString(value)).filter(Boolean))
  );

  const categories = (categoryPool.length > 0 ? categoryPool : DEFAULT_CATEGORIES).slice(0, 3);
  const searchQuery = categories.map((cat) => `cat:${cat}`).join(' OR ');

  const candidates = await fetchArxivByQuery(searchQuery, Math.max(limit * 3, 24));
  const excluded = new Set(excludeArxivIds.map(normalizeArxivId));
  const seen = new Set<string>();

  return candidates
    .filter((paper) => {
      const key = normalizeArxivId(paper.arxivId);
      if (!key || excluded.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, limit);
}

export async function fetchSimilarPapersForMetadata(
  metadata: PaperMetadata,
  limit = 3
): Promise<SimilarPaper[]> {
  const titleTokens = tokenize(metadata.title).slice(0, 6);
  const abstractTokens = tokenize(metadata.abstract).slice(0, 24);
  const importantTokens = Array.from(new Set([...titleTokens, ...abstractTokens])).slice(0, 10);

  const categories = metadata.categories.slice(0, 2);

  const queryParts: string[] = [];
  if (categories.length > 0) {
    queryParts.push(...categories.map((cat) => `cat:${cat}`));
  }
  if (importantTokens.length > 0) {
    queryParts.push(...importantTokens.slice(0, 4).map((token) => `all:${token}`));
  }

  const searchQuery = queryParts.length > 0 ? queryParts.join(' OR ') : 'cat:cs.AI OR cat:cs.LG';

  const candidates = await fetchArxivByQuery(searchQuery, 32);
  const sourceTokens = tokenize(`${metadata.title} ${metadata.abstract}`);
  const sourceCategories = new Set(metadata.categories);
  const selfId = normalizeArxivId(metadata.id);

  const scored = candidates
    .filter((paper) => normalizeArxivId(paper.arxivId) !== selfId)
    .map((paper) => {
      const candidateTokens = tokenize(`${paper.title} ${paper.summary}`);
      const lexicalScore = jaccardScore(sourceTokens, candidateTokens);
      const categoryOverlap = paper.categories.filter((cat) => sourceCategories.has(cat)).length;
      const categoryScore = sourceCategories.size > 0 ? categoryOverlap / sourceCategories.size : 0;
      const recentBoost = paper.published ? 0.06 : 0;
      const similarityScore = lexicalScore * 0.72 + categoryScore * 0.22 + recentBoost;

      return {
        ...paper,
        similarityScore: Number(similarityScore.toFixed(4)),
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);

  return scored;
}
