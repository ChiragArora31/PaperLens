import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { PaperAnalysis } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ExportBody {
  analysis?: PaperAnalysis;
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function ensureArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 24);
}

function fileSafeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function wrapText(line: string, maxWidth: number, size: number, widthOfText: (text: string) => number): string[] {
  const cleaned = line.trim();
  if (!cleaned) return [''];

  const words = cleaned.split(/\s+/);
  const lines: string[] = [];
  let current = words[0] ?? '';

  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (widthOfText(next) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExportBody;
    const analysis = body.analysis;

    if (!analysis?.metadata?.title) {
      return NextResponse.json(
        { success: false, error: 'Analysis payload is required to export PDF summary.' },
        { status: 400 }
      );
    }

    const title = cleanText(analysis.metadata.title) || 'Untitled Paper';
    const arxivId = cleanText(analysis.metadata.id);
    const authors = ensureArray(analysis.metadata.authors).slice(0, 8).join(', ');

    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const width = 612;
    const height = 792;
    const marginX = 52;
    const marginTop = 64;
    const marginBottom = 58;
    const maxWidth = width - marginX * 2;

    let page = pdfDoc.addPage([width, height]);
    let cursorY = height - marginTop;

    const addWatermark = (targetPage: ReturnType<typeof pdfDoc.addPage>) => {
      targetPage.drawText('PaperLens • paperlens.in', {
        x: 110,
        y: height / 2.1,
        size: 44,
        font: fontBold,
        color: rgb(0, 0, 0),
        opacity: 0.08,
        rotate: degrees(32),
      });
    };

    const newPage = () => {
      page = pdfDoc.addPage([width, height]);
      addWatermark(page);
      cursorY = height - marginTop;
    };

    const ensureSpace = (needed: number) => {
      if (cursorY - needed < marginBottom) {
        newPage();
      }
    };

    const drawLine = (text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number] }) => {
      const size = options?.size ?? 11.5;
      const font = options?.bold ? fontBold : fontRegular;
      const colorTuple = options?.color ?? [0.08, 0.1, 0.16];
      const widthOfText = (value: string) => font.widthOfTextAtSize(value, size);
      const wrapped = wrapText(text, maxWidth, size, widthOfText);
      const lineHeight = size * 1.45;

      ensureSpace(wrapped.length * lineHeight + 4);
      wrapped.forEach((line) => {
        page.drawText(line, {
          x: marginX,
          y: cursorY,
          size,
          font,
          color: rgb(colorTuple[0], colorTuple[1], colorTuple[2]),
        });
        cursorY -= lineHeight;
      });
    };

    const drawSectionTitle = (text: string) => {
      ensureSpace(34);
      drawLine(text, { size: 16, bold: true, color: [0.05, 0.08, 0.15] });
      cursorY -= 4;
    };

    const drawBulletList = (items: string[]) => {
      items.forEach((item) => {
        const bullet = `• ${item}`;
        drawLine(bullet, { size: 11.3 });
      });
      cursorY -= 4;
    };

    addWatermark(page);

    drawLine('PaperLens Summary Export', { size: 11, bold: true, color: [0.2, 0.22, 0.3] });
    drawLine(title, { size: 24, bold: true, color: [0.02, 0.03, 0.08] });

    if (authors) {
      drawLine(`Authors: ${authors}`, { size: 11.3, color: [0.22, 0.25, 0.33] });
    }
    if (arxivId) {
      drawLine(`arXiv: ${arxivId}`, { size: 11.3, color: [0.22, 0.25, 0.33] });
    }

    drawLine(`Exported on ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, {
      size: 10.5,
      color: [0.35, 0.38, 0.45],
    });

    cursorY -= 8;

    drawSectionTitle('TL;DR');
    drawLine(cleanText(analysis.tldr?.summary) || 'Summary unavailable.');
    const keyTakeaways = ensureArray(analysis.tldr?.keyTakeaways).slice(0, 8);
    if (keyTakeaways.length > 0) drawBulletList(keyTakeaways);

    drawSectionTitle('One Minute Summary');
    drawLine(cleanText(analysis.summarySuite?.oneMinute) || cleanText(analysis.summarySuite?.ultraShort) || '');

    drawSectionTitle('Five Minute Walkthrough');
    drawLine(cleanText(analysis.summarySuite?.fiveMinute) || cleanText(analysis.summarySuite?.detailed) || '');

    drawSectionTitle('Explanations');
    drawLine('Intuition', { size: 12.2, bold: true, color: [0.08, 0.1, 0.16] });
    drawLine(cleanText(analysis.explanations?.eli15) || '');
    drawLine('Engineer Lens', { size: 12.2, bold: true, color: [0.08, 0.1, 0.16] });
    drawLine(cleanText(analysis.explanations?.engineer) || '');
    drawLine('Deep Technical', { size: 12.2, bold: true, color: [0.08, 0.1, 0.16] });
    drawLine(cleanText(analysis.explanations?.deepTechnical) || '');

    const concepts = Array.isArray(analysis.concepts) ? analysis.concepts.slice(0, 5) : [];
    if (concepts.length > 0) {
      drawSectionTitle('Core Concepts');
      concepts.forEach((concept, index) => {
        drawLine(`${index + 1}. ${cleanText(concept.name) || `Concept ${index + 1}`}`, {
          size: 12.2,
          bold: true,
        });
        drawLine(cleanText(concept.intuition) || cleanText(concept.technicalDefinition));
      });
    }

    const steps = Array.isArray(analysis.learningPath?.steps) ? analysis.learningPath.steps.slice(0, 7) : [];
    if (steps.length > 0) {
      drawSectionTitle('Learning Path');
      steps.forEach((step, index) => {
        drawLine(`${index + 1}. ${cleanText(step.stepTitle)} (${step.estimatedMinutes} min)`, {
          size: 11.8,
          bold: true,
        });
        drawLine(cleanText(step.goal) || cleanText(step.output));
      });
    }

    const pageCount = pdfDoc.getPageCount();
    for (let i = 0; i < pageCount; i += 1) {
      const item = pdfDoc.getPage(i);
      item.drawText(`Page ${i + 1} of ${pageCount}`, {
        x: width - 110,
        y: 24,
        size: 9.5,
        font: fontRegular,
        color: rgb(0.35, 0.38, 0.45),
      });
    }

    const bytes = await pdfDoc.save();
    const filename = `${fileSafeName(title) || 'paperlens-summary'}.pdf`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('PDF export route error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Could not generate PDF summary right now.',
      },
      { status: 500 }
    );
  }
}
