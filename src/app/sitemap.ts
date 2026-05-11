import type { MetadataRoute } from 'next';
import { listPublicPapers } from '@/lib/db';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://paperlens.in';
  const now = new Date();
  const publicPapers = listPublicPapers(24);

  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/dashboard`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.4,
    },
    ...publicPapers.map((paper) => ({
      url: `${baseUrl}/paper/${paper.arxivId}`,
      lastModified: new Date(paper.lastAnalyzedAt),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
