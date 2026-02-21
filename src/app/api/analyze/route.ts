import { NextRequest, NextResponse } from 'next/server';
import { extractArxivId, fetchArxivMetadata, fetchArxivPaperText } from '@/lib/arxiv';
import { analyzePaper } from '@/lib/gemini';

export const maxDuration = 120;
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body. Send `{ "arxivId": "..." }`.' },
        { status: 400 }
      );
    }

    const { arxivId } = body as { arxivId?: unknown };
    if (typeof arxivId !== 'string' || !arxivId.trim()) {
      return NextResponse.json(
        { success: false, error: 'arXiv ID is required' },
        { status: 400 }
      );
    }

    if (arxivId.length > 256) {
      return NextResponse.json(
        { success: false, error: 'Input too long. Use only an arXiv URL or ID.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Server API key is missing. Set GEMINI_API_KEY.' },
        { status: 500 }
      );
    }

    const normalizedArxivId = extractArxivId(arxivId);
    if (!normalizedArxivId) {
      return NextResponse.json(
        { success: false, error: 'Invalid arXiv link or ID format.' },
        { status: 400 }
      );
    }

    const metadata = await fetchArxivMetadata(normalizedArxivId);
    const paperContent = await fetchArxivPaperText(normalizedArxivId, metadata);
    const paperText = paperContent.text;

    const analysis = await analyzePaper(paperText, metadata, apiKey);

    if (paperContent.source !== 'pdf') {
      console.warn('Paper text fallback source used:', {
        arxivId: normalizedArxivId,
        source: paperContent.source,
        diagnostics: paperContent.diagnostics,
      });
    }

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    const message = error instanceof Error ? error.message : 'An unexpected error occurred';
    const status =
      /timeout|failed to fetch|network|upstream|unavailable/i.test(message) ? 502 : 500;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
