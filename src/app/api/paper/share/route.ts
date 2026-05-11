import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { trackRequestEvent } from '@/lib/analytics';
import { savePublicPaperSnapshot } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const shareSchema = z.object({
  analysis: z.object({
    metadata: z.object({
      id: z.string().min(1).max(80),
      title: z.string().min(1).max(500),
      abstract: z.string().max(6000).optional(),
      authors: z.array(z.string().max(200)).optional(),
      categories: z.array(z.string().max(80)).optional(),
    }),
  }).passthrough(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid paper analysis payload.' }, { status: 400 });
    }

    const metadata = parsed.data.analysis.metadata;
    const paper = savePublicPaperSnapshot({
      arxivId: metadata.id,
      title: metadata.title,
      abstract: metadata.abstract,
      authors: metadata.authors,
      categories: metadata.categories,
      analysis: parsed.data.analysis,
    });

    void trackRequestEvent(request, {
      eventName: 'share_link_created',
      arxivId: paper.arxivId,
      title: paper.title,
    });

    return NextResponse.json({
      success: true,
      data: {
        url: `/paper/${encodeURIComponent(paper.arxivId)}`,
        arxivId: paper.arxivId,
      },
    });
  } catch (error) {
    console.error('Share paper error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to create share link right now.' },
      { status: 500 }
    );
  }
}
