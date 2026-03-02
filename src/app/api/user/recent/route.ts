import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { upsertRecentPaper } from '@/lib/db';

const recentSchema = z.object({
  arxivId: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  abstract: z.string().max(5000).optional(),
  authors: z.array(z.string().max(200)).optional(),
  categories: z.array(z.string().max(64)).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = recentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid recent paper payload.' }, { status: 400 });
    }

    upsertRecentPaper(userId, parsed.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Recent paper tracking error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to track recent paper.' },
      { status: 500 }
    );
  }
}
