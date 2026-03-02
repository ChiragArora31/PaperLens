export interface UserPaperInput {
  arxivId: string;
  title: string;
  abstract?: string;
  authors?: string[];
  categories?: string[];
}

export function cleanString(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeList(values: string[] | undefined): string[] {
  if (!values) return [];
  return Array.from(
    new Set(values.map((value) => cleanString(value)).filter(Boolean))
  ).slice(0, 20);
}

export function encodeList(values: string[] | undefined): string {
  return JSON.stringify(normalizeList(values));
}

export function decodeList(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => (typeof item === 'string' ? cleanString(item) : '')).filter(Boolean);
  } catch {
    return [];
  }
}

export function normalizeArxivInput(raw: UserPaperInput): UserPaperInput {
  return {
    arxivId: cleanString(raw.arxivId),
    title: cleanString(raw.title),
    abstract: cleanString(raw.abstract ?? ''),
    authors: normalizeList(raw.authors),
    categories: normalizeList(raw.categories),
  };
}
