import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface PodcastSegment {
  speaker: string;
  content: string;
}

interface PodcastPayload {
  title: string;
  intro: string;
  segments: PodcastSegment[];
  outro: string;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function extractJsonObject(text: string): string {
  const source = text.trim();
  const start = source.indexOf('{');
  if (start < 0) return source;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < source.length; i += 1) {
    const char = source[i];

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

    if (depth === 0) return source.slice(start, i + 1);
  }

  return source.slice(start);
}

function parseLooseJson(raw: string): PodcastPayload | null {
  try {
    return JSON.parse(raw) as PodcastPayload;
  } catch {
    // Try extracted json object.
  }

  try {
    return JSON.parse(extractJsonObject(raw)) as PodcastPayload;
  } catch {
    return null;
  }
}

function buildFallbackScript(input: {
  title: string;
  tldr: string;
  keyTakeaways: string[];
  engineer: string;
}): PodcastPayload {
  const takeaways = input.keyTakeaways.slice(0, 3);
  return {
    title: `PaperLens Audio Brief: ${input.title}`,
    intro: `Welcome to PaperLens. Today we decode ${input.title} in a concise, practical format.`,
    segments: [
      {
        speaker: 'Host',
        content: input.tldr,
      },
      {
        speaker: 'Analyst',
        content:
          takeaways.length > 0
            ? `Top takeaways: ${takeaways.join(' | ')}`
            : 'The paper introduces a method, validates it experimentally, and discusses trade-offs.',
      },
      {
        speaker: 'Engineer',
        content: input.engineer,
      },
    ],
    outro: 'That wraps this PaperLens brief. Revisit the diagrams and concept cards to lock in understanding.',
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      metadata?: { title?: string };
      tldr?: { summary?: string; keyTakeaways?: string[] };
      explanations?: { engineer?: string };
    };

    const title = normalizeText(body.metadata?.title) || 'Untitled Research Paper';
    const tldr = normalizeText(body.tldr?.summary);
    const keyTakeaways = Array.isArray(body.tldr?.keyTakeaways)
      ? body.tldr?.keyTakeaways.map((item) => normalizeText(item)).filter(Boolean)
      : [];
    const engineer = normalizeText(body.explanations?.engineer);

    const fallback = buildFallbackScript({
      title,
      tldr: tldr || 'This paper proposes a method and demonstrates why it matters.',
      keyTakeaways,
      engineer: engineer || 'The implementation combines core components to improve quality and reliability.',
    });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: true, data: fallback });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.35,
      },
    });

    const prompt = `Create a podcast script for this research paper.
Return JSON only with this shape:
{
  "title": "...",
  "intro": "...",
  "segments": [{"speaker":"Host","content":"..."}],
  "outro": "..."
}
Rules:
1) 5 to 7 segments.
2) Keep each segment short (2-4 sentences).
3) Explain intuition, method, and practical impact.
4) Use technical precision without sounding dry.

Paper title: ${title}
TLDR: ${fallback.segments[0].content}
Key takeaways: ${keyTakeaways.join(' | ')}
Engineer lens: ${fallback.segments[2].content}`;

    const response = await model.generateContent(prompt);
    const parsed = parseLooseJson(response.response.text());

    if (!parsed || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
      return NextResponse.json({ success: true, data: fallback });
    }

    const normalized: PodcastPayload = {
      title: normalizeText(parsed.title) || fallback.title,
      intro: normalizeText(parsed.intro) || fallback.intro,
      segments: parsed.segments
        .map((segment) => ({
          speaker: normalizeText(segment.speaker) || 'Host',
          content: normalizeText(segment.content),
        }))
        .filter((segment) => segment.content.length > 0)
        .slice(0, 7),
      outro: normalizeText(parsed.outro) || fallback.outro,
    };

    if (normalized.segments.length === 0) {
      return NextResponse.json({ success: true, data: fallback });
    }

    return NextResponse.json({ success: true, data: normalized });
  } catch (error) {
    console.error('Podcast route error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Could not generate podcast script right now.',
      },
      { status: 500 }
    );
  }
}
