import { NextRequest, NextResponse } from 'next/server';
import { extractArxivId, fetchArxivMetadata } from '@/lib/arxiv';
import { answerQuestionWithCitations } from '@/lib/paperRag';
import type { ChatMessage } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeHistory(history: unknown): ChatMessage[] {
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => {
      const candidate = item as { role?: unknown; content?: unknown };
      const role = candidate.role === 'assistant' ? 'assistant' : candidate.role === 'user' ? 'user' : null;
      const content = typeof candidate.content === 'string' ? candidate.content.trim() : '';
      if (!role || !content) return null;
      return { role, content };
    })
    .filter((item): item is ChatMessage => Boolean(item))
    .slice(-10);
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      arxivId?: string;
      question?: string;
      history?: unknown;
    };

    const rawArxiv = typeof body.arxivId === 'string' ? body.arxivId : '';
    const question = typeof body.question === 'string' ? body.question.trim() : '';

    const arxivId = extractArxivId(rawArxiv);
    if (!arxivId) {
      return NextResponse.json({ success: false, error: 'Invalid arXiv ID or URL.' }, { status: 400 });
    }

    if (!question || question.length < 3) {
      return NextResponse.json(
        { success: false, error: 'Please ask a specific paper question.' },
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

    const metadata = await fetchArxivMetadata(arxivId);
    const result = await answerQuestionWithCitations({
      arxivId,
      metadata,
      question,
      history: normalizeHistory(body.history),
      apiKey,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Paper chat route error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Could not generate a cited answer right now. Please retry.',
      },
      { status: 500 }
    );
  }
}
