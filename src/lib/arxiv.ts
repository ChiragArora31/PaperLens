// ===== arXiv Utilities =====

import { PaperMetadata } from './types';

const ARXIV_FETCH_TIMEOUT_MS = 25000;
const ARXIV_USER_AGENT = 'PaperLens/1.0';
const MIN_MEANINGFUL_PAPER_TEXT_CHARS = 1200;

type ContentSource = 'pdf' | 'ar5iv_html' | 'arxiv_html' | 'metadata_fallback';
const ARXIV_ID_PATTERN =
  /^((?:[a-z-]+(?:\.[a-z-]+)?\/\d{7}(?:v\d+)?)|\d{4}\.\d{4,6}(?:v\d+)?)$/i;
const ARXIV_HOST_PATTERN = /(^|\.)arxiv\.org$|(^|\.)ar5iv\.org$|(^|\.)export\.arxiv\.org$/i;

export interface ArxivPaperTextResult {
  text: string;
  source: ContentSource;
  diagnostics: string[];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(value: string): string {
  return normalizeWhitespace(decodeHtmlEntities(value));
}

function stripVersionSuffix(arxivId: string): string {
  return arxivId.replace(/v\d+$/i, '');
}

function normalizeArxivId(arxivId: string): string {
  const withoutArtifacts = arxivId
    .trim()
    .replace(/^arxiv:\s*/i, '')
    .replace(/^[<(["']+/, '')
    .replace(/[>\])"';:,.]+$/, '')
    .replace(/\/+$/, '')
    .replace(/\.html?$/i, '')
    .replace(/\.ps\.gz$/i, '')
    .replace(/\.gz$/i, '')
    .replace(/\.pdf$/i, '');

  try {
    return decodeURIComponent(withoutArtifacts);
  } catch {
    return withoutArtifacts;
  }
}

function isValidArxivId(arxivId: string): boolean {
  return ARXIV_ID_PATTERN.test(arxivId);
}

function extractMetaContent(html: string, name: string): string[] {
  const patterns = [
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([\\s\\S]*?)["'][^>]*>`,
      'gi'
    ),
    new RegExp(
      `<meta[^>]+content=["']([\\s\\S]*?)["'][^>]+name=["']${name}["'][^>]*>`,
      'gi'
    ),
  ];
  const values: string[] = [];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      const value = cleanText(match[1] ?? '');
      if (value) values.push(value);
    }
  }

  return values;
}

function extractFirstTag(source: string, tagPattern: string): string {
  const regex = new RegExp(`<${tagPattern}[^>]*>([\\s\\S]*?)<\\/${tagPattern}>`, 'i');
  const match = source.match(regex);
  return cleanText(match?.[1] ?? '');
}

function metadataLooksComplete(metadata: Partial<PaperMetadata>): boolean {
  return Boolean(
    metadata.title &&
      metadata.title !== 'Unknown Title' &&
      metadata.abstract &&
      metadata.abstract.length > 30 &&
      metadata.authors &&
      metadata.authors.length > 0
  );
}

function mergeMetadata(
  arxivId: string,
  primary: Partial<PaperMetadata>,
  fallback: Partial<PaperMetadata>
): PaperMetadata {
  const mergedAuthors = [
    ...(primary.authors ?? []),
    ...(fallback.authors ?? []),
  ].filter(Boolean);

  const mergedCategories = [
    ...(primary.categories ?? []),
    ...(fallback.categories ?? []),
  ].filter(Boolean);

  const dedupedAuthors = Array.from(new Set(mergedAuthors));
  const dedupedCategories = Array.from(new Set(mergedCategories));

  const title = cleanText(
    primary.title || fallback.title || `arXiv Paper ${stripVersionSuffix(arxivId)}`
  );
  const abstract = cleanText(primary.abstract || fallback.abstract || '');
  const published = cleanText(primary.published || fallback.published || '');

  return {
    id: arxivId,
    title: title || `arXiv Paper ${stripVersionSuffix(arxivId)}`,
    authors: dedupedAuthors,
    abstract,
    categories: dedupedCategories,
    published,
    pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
  };
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ARXIV_FETCH_TIMEOUT_MS);
  const headers = new Headers(init?.headers);
  if (!headers.has('User-Agent')) {
    headers.set('User-Agent', ARXIV_USER_AGENT);
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
  }

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      headers,
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseApiMetadata(xmlText: string): Partial<PaperMetadata> {
  const entryMatch = xmlText.match(/<(?:\w+:)?entry\b[\s\S]*?<\/(?:\w+:)?entry>/i);
  if (!entryMatch) return {};

  const entry = entryMatch[0];
  const title = extractFirstTag(entry, '(?:\\w+:)?title');
  const abstract = extractFirstTag(entry, '(?:\\w+:)?summary');
  const published = extractFirstTag(entry, '(?:\\w+:)?published');

  const authors = Array.from(
    entry.matchAll(/<(?:\w+:)?author>\s*<(?:\w+:)?name>([\s\S]*?)<\/(?:\w+:)?name>/gi),
    (m) => cleanText(m[1] ?? '')
  ).filter(Boolean);

  const categories = Array.from(
    entry.matchAll(/<(?:\w+:)?category[^>]*term=["']([^"']+)["'][^>]*\/?>/gi),
    (m) => cleanText(m[1] ?? '')
  ).filter(Boolean);

  return {
    title,
    abstract,
    authors,
    categories,
    published,
  };
}

function parseAbsPageMetadata(html: string): Partial<PaperMetadata> {
  const title =
    extractMetaContent(html, 'citation_title')[0] ||
    cleanText(
      (html.match(/<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '')
        .replace(/^title:\s*/i, '')
    );

  const authors = extractMetaContent(html, 'citation_author');

  const abstract =
    extractMetaContent(html, 'citation_abstract')[0] ||
    cleanText(
      (html.match(
        /<blockquote[^>]*class=["'][^"']*abstract[^"']*["'][^>]*>([\s\S]*?)<\/blockquote>/i
      )?.[1] ?? '')
        .replace(/^abstract:\s*/i, '')
    );

  const published =
    extractMetaContent(html, 'citation_date')[0] ||
    extractMetaContent(html, 'citation_publication_date')[0] ||
    '';

  const categories = extractMetaContent(html, 'citation_keywords');

  return {
    title: cleanText(title),
    authors: authors.map(cleanText).filter(Boolean),
    abstract: cleanText(abstract),
    categories: categories.map(cleanText).filter(Boolean),
    published: cleanText(published),
  };
}

function stripHtmlToText(html: string): string {
  const scoped =
    html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;

  return cleanText(
    scoped
      .replace(/<(script|style|noscript|svg|header|footer|nav|aside)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|h1|h2|h3|h4|h5|h6|li|tr)>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  );
}

function isMeaningfulPaperText(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  const alphaChars = (normalized.match(/[A-Za-z]/g) ?? []).length;
  return normalized.length >= MIN_MEANINGFUL_PAPER_TEXT_CHARS && alphaChars >= 500;
}

async function extractPdfTextFromBuffer(buffer: ArrayBuffer): Promise<string> {
  const pdfModule = (await import('pdf-parse')) as unknown as {
    PDFParse?: new (options: { data: Uint8Array }) => {
      getText: () => Promise<{ text?: string }>;
      destroy?: () => Promise<void>;
    };
    default?: (data: Buffer | Uint8Array) => Promise<{ text?: string }>;
  };

  if (typeof pdfModule.PDFParse === 'function') {
    const parser = new pdfModule.PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return normalizeWhitespace(result?.text ?? '');
    } finally {
      if (parser.destroy) {
        await parser.destroy();
      }
    }
  }

  if (typeof pdfModule.default === 'function') {
    const result = await pdfModule.default(Buffer.from(buffer));
    return normalizeWhitespace(result?.text ?? '');
  }

  throw new Error('Unsupported pdf-parse module format');
}

async function tryFetchHtmlPaperText(arxivId: string): Promise<{ text: string; source: ContentSource } | null> {
  const htmlCandidates: Array<{ url: string; source: ContentSource }> = [
    { url: `https://ar5iv.org/html/${arxivId}`, source: 'ar5iv_html' },
    { url: `https://arxiv.org/html/${arxivId}`, source: 'arxiv_html' },
  ];

  for (const candidate of htmlCandidates) {
    try {
      const response = await fetchWithTimeout(candidate.url);
      if (!response.ok) continue;

      const html = await response.text();
      const text = stripHtmlToText(html);
      if (isMeaningfulPaperText(text)) {
        return { text, source: candidate.source };
      }
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

function stripQueryAndHash(value: string): string {
  return value.split(/[?#]/, 1)[0] ?? '';
}

function parseArxivIdFromPathname(pathname: string): string | null {
  const cleanedPath = stripQueryAndHash(pathname).replace(/^\/+|\/+$/g, '');
  if (!cleanedPath) return null;

  const segments = cleanedPath.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const first = segments[0]?.toLowerCase();
  const prefixes = new Set(['abs', 'pdf', 'html', 'format', 'e-print', 'src']);

  const rawCandidate = prefixes.has(first)
    ? segments.slice(1).join('/')
    : segments.join('/');
  if (!rawCandidate) return null;

  const normalized = normalizeArxivId(rawCandidate);
  return isValidArxivId(normalized) ? normalized : null;
}

function parseArxivIdFromUrl(input: string): string | null {
  const hasProtocol = /^[a-z][a-z\d+\-.]*:\/\//i.test(input);
  const candidateUrl = hasProtocol ? input : `https://${input}`;

  try {
    const parsed = new URL(candidateUrl);
    if (!ARXIV_HOST_PATTERN.test(parsed.hostname)) {
      return null;
    }

    const fromPath = parseArxivIdFromPathname(parsed.pathname);
    if (fromPath) return fromPath;

    for (const key of ['id', 'arxivId', 'paper']) {
      const value = parsed.searchParams.get(key);
      if (!value) continue;
      const normalized = normalizeArxivId(value);
      if (isValidArxivId(normalized)) return normalized;
    }
  } catch {
    return null;
  }

  return null;
}

function parseArxivIdFromFreeform(input: string): string | null {
  const match = input.match(
    /((?:[a-z-]+(?:\.[a-z-]+)?\/\d{7}(?:v\d+)?)|(?:\d{4}\.\d{4,6}(?:v\d+)?))/i
  );
  if (!match?.[1]) return null;
  const normalized = normalizeArxivId(match[1]);
  return isValidArxivId(normalized) ? normalized : null;
}

function parseArxivIdFromHostText(input: string): string | null {
  const match = input.match(
    /(?:https?:\/\/)?(?:www\.)?(?:arxiv\.org|ar5iv\.org|export\.arxiv\.org)\/(?:abs|pdf|html|format|e-print|src)\/([^\s?#)\]>"']+)/i
  );
  if (!match?.[1]) return null;
  const normalized = normalizeArxivId(match[1]);
  return isValidArxivId(normalized) ? normalized : null;
}

function looksLikeUrlInput(input: string): boolean {
  return (
    /^[a-z][a-z\d+\-.]*:\/\//i.test(input) ||
    /^www\./i.test(input) ||
    /\b[a-z0-9-]+\.[a-z]{2,}(?::\d+)?(?:\/|$)/i.test(input)
  );
}

/**
 * Extract arXiv paper ID from various input formats:
 * - Full URL: https://arxiv.org/abs/2401.12345
 * - PDF URL: https://arxiv.org/pdf/2401.12345
 * - arXiv:2401.12345
 * - Old format: hep-th/9901001
 */
export function extractArxivId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const direct = normalizeArxivId(trimmed);
  if (isValidArxivId(direct)) return direct;

  const fromUrl = parseArxivIdFromUrl(trimmed);
  if (fromUrl) return fromUrl;

  const strippedPrefix = trimmed.replace(/^arxiv:\s*/i, '');
  const fromPrefixedUrl = parseArxivIdFromUrl(strippedPrefix);
  if (fromPrefixedUrl) return fromPrefixedUrl;

  const fromHostText = parseArxivIdFromHostText(strippedPrefix);
  if (fromHostText) return fromHostText;

  // URL-like non-arXiv inputs should be rejected instead of falling through to freeform ID extraction.
  if (looksLikeUrlInput(strippedPrefix)) {
    return null;
  }

  return parseArxivIdFromFreeform(strippedPrefix);
}

/**
 * Fetch paper metadata from arXiv with layered fallback.
 */
export async function fetchArxivMetadata(arxivId: string): Promise<PaperMetadata> {
  const normalizedId = normalizeArxivId(arxivId);
  if (!isValidArxivId(normalizedId)) {
    throw new Error('Invalid arXiv ID format');
  }
  const idCandidates = Array.from(
    new Set([normalizedId, stripVersionSuffix(normalizedId)].filter(Boolean))
  );

  let apiMetadata: Partial<PaperMetadata> = {};
  for (const idCandidate of idCandidates) {
    try {
      const apiUrl = `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(idCandidate)}`;
      const response = await fetchWithTimeout(apiUrl);
      if (response.ok) {
        const xmlText = await response.text();
        apiMetadata = parseApiMetadata(xmlText);
      }
      if (metadataLooksComplete(apiMetadata)) break;
    } catch {
      // Continue with fallback.
    }
  }

  let absMetadata: Partial<PaperMetadata> = {};
  if (!metadataLooksComplete(apiMetadata)) {
    for (const idCandidate of idCandidates) {
      try {
        const absResponse = await fetchWithTimeout(`https://arxiv.org/abs/${idCandidate}`);
        if (absResponse.ok) {
          const absHtml = await absResponse.text();
          absMetadata = parseAbsPageMetadata(absHtml);
        }
        if (metadataLooksComplete(absMetadata)) break;
      } catch {
        // Continue with best available metadata.
      }
    }
  }

  return mergeMetadata(normalizedId, apiMetadata, absMetadata);
}

/**
 * Download and extract text from arXiv PDF.
 */
export async function fetchArxivPdfText(arxivId: string): Promise<string> {
  const normalizedId = normalizeArxivId(arxivId);
  const idCandidates = Array.from(
    new Set([normalizedId, stripVersionSuffix(normalizedId)].filter(Boolean))
  );

  let lastError = '';
  for (const idCandidate of idCandidates) {
    const pdfUrl = `https://arxiv.org/pdf/${idCandidate}.pdf`;
    const response = await fetchWithTimeout(pdfUrl);

    if (!response.ok) {
      lastError = `Failed to fetch PDF: ${response.status} ${response.statusText}`;
      continue;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (!/application\/pdf/i.test(contentType)) {
      lastError = `Unexpected content type while fetching PDF: ${contentType || 'unknown'}`;
      continue;
    }

    const buffer = await response.arrayBuffer();
    return extractPdfTextFromBuffer(buffer);
  }

  throw new Error(lastError || 'Failed to fetch PDF');
}

export async function fetchArxivPaperText(
  arxivId: string,
  metadata: PaperMetadata
): Promise<ArxivPaperTextResult> {
  const diagnostics: string[] = [];
  const normalizedId = normalizeArxivId(arxivId);

  try {
    const pdfText = await fetchArxivPdfText(normalizedId);
    if (isMeaningfulPaperText(pdfText)) {
      return {
        text: pdfText,
        source: 'pdf',
        diagnostics,
      };
    }
    diagnostics.push(`PDF text too short (${pdfText.length} chars).`);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/timeout|aborted/i.test(message)) {
      diagnostics.push('PDF extraction timed out.');
    } else if (/failed to fetch pdf|unexpected content type/i.test(message)) {
      diagnostics.push('PDF retrieval was unavailable.');
    } else {
      diagnostics.push('PDF extraction was unavailable in this environment.');
    }
    if (process.env.NODE_ENV !== 'production') {
      console.warn('PDF extraction fallback triggered:', message || error);
    }
  }

  const htmlFallback = await tryFetchHtmlPaperText(normalizedId);
  if (htmlFallback) {
    diagnostics.push(`Using fallback source: ${htmlFallback.source}`);
    return {
      text: htmlFallback.text,
      source: htmlFallback.source,
      diagnostics,
    };
  }

  diagnostics.push('Using metadata/abstract fallback text.');
  const abstract = cleanText(metadata.abstract);
  const fallbackText = normalizeWhitespace([
    `Title: ${metadata.title}`,
    metadata.authors.length > 0 ? `Authors: ${metadata.authors.join(', ')}` : '',
    abstract ? `Abstract: ${abstract}` : '',
  ].filter(Boolean).join('\n\n'));

  return {
    text: fallbackText || `Title: ${metadata.title}`,
    source: 'metadata_fallback',
    diagnostics,
  };
}
