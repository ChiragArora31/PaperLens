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

function parseEntries(feed: string): RecommendedPaper[] {
  const entries = feed.match(/<(?:\\w+:)?entry>[\\s\\S]*?<\/(?:\\w+:)?entry>/gi) ?? [];

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARXIV_TIMEOUT_MS);

  try {
    const url =
      `https://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}` +
      '&start=0&max_results=24&sortBy=submittedDate&sortOrder=descending';

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
    const excluded = new Set(excludeArxivIds.map(normalizeArxivId));
    const seen = new Set<string>();

    return parseEntries(feed)
      .filter((paper) => {
        const key = normalizeArxivId(paper.arxivId);
        if (!key || excluded.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
