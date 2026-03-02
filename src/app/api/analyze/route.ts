import { NextRequest, NextResponse } from 'next/server';
import { extractArxivId, fetchArxivMetadata, fetchArxivPaperText } from '@/lib/arxiv';
import { analyzePaper, buildFallbackAnalysis } from '@/lib/gemini';
import { fetchSimilarPapersForMetadata } from '@/lib/recommendations';
import { buildEvidenceForAnalysis, computeReliability } from '@/lib/analysisEnhancer';
import type { PaperAnalysis, SimilarPaper } from '@/lib/types';

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
      return NextResponse.json({ success: false, error: 'arXiv ID is required' }, { status: 400 });
    }

    if (arxivId.length > 256) {
      return NextResponse.json(
        { success: false, error: 'Input too long. Use only an arXiv URL or ID.' },
        { status: 400 }
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
    const apiKey = process.env.GEMINI_API_KEY;

    let analysis: PaperAnalysis;
    let modelMode: 'model' | 'fallback' = 'model';
    let modelFallbackReason = '';

    if (apiKey) {
      try {
        analysis = await analyzePaper(paperText, metadata, apiKey);
      } catch (modelError) {
        modelMode = 'fallback';
        modelFallbackReason =
          modelError instanceof Error ? modelError.message : 'Unknown model generation error.';
        analysis = buildFallbackAnalysis(paperText, metadata, modelFallbackReason);
      }
    } else {
      modelMode = 'fallback';
      modelFallbackReason = 'Server GEMINI_API_KEY is missing.';
      analysis = buildFallbackAnalysis(paperText, metadata, modelFallbackReason);
    }

    let similarPapers: SimilarPaper[] = [];
    try {
      similarPapers = await fetchSimilarPapersForMetadata(metadata, 3);
    } catch (similarError) {
      console.warn('Similar papers fetch failed:', similarError);
    }

    let evidence = analysis.evidence;
    let evidenceCoverage = 0;
    const evidenceNotes: string[] = [];
    try {
      const evidenceResult = await buildEvidenceForAnalysis({
        arxivId: normalizedArxivId,
        metadata,
        analysis,
      });
      evidence = evidenceResult.evidence;
      evidenceCoverage = evidenceResult.coverage;
      evidenceNotes.push(...evidenceResult.notes);
    } catch (evidenceError) {
      evidenceNotes.push('Evidence mapping failed. Use direct section reading for verification.');
      console.warn('Evidence mapping failed:', evidenceError);
    }

    const reliability = computeReliability({
      source: paperContent.source,
      modelMode,
      extractedChars: paperText.length,
      diagnostics: [
        ...paperContent.diagnostics,
        ...(modelFallbackReason ? [`Model fallback reason: ${modelFallbackReason}`] : []),
        ...evidenceNotes,
      ],
      evidenceCoverage,
      conceptCount: analysis.concepts.length,
    });

    if (paperContent.source !== 'pdf') {
      console.warn('Paper text fallback source used:', {
        arxivId: normalizedArxivId,
        source: paperContent.source,
        diagnostics: paperContent.diagnostics,
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...analysis,
        similarPapers,
        evidence,
        reliability,
      },
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
