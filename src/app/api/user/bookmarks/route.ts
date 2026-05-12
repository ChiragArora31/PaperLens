import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import {
  ensureSessionUser,
  isBookmarked,
  listBookmarks,
  removeBookmark,
  upsertBookmark,
} from '@/lib/db';
import { trackRequestEvent } from '@/lib/analytics';

const bookmarkSchema = z.object({
  arxivId: z.string().min(1).max(64),
  title: z.string().min(1).max(500),
  abstract: z.string().max(5000).optional(),
  authors: z.array(z.string().max(200)).optional(),
  categories: z.array(z.string().max(64)).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = await ensureSessionUser({
      id: session?.user?.id,
      email: session?.user?.email,
      name: session?.user?.name,
      image: session?.user?.image,
    });
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const arxivId = searchParams.get('arxivId');

    if (arxivId) {
      return NextResponse.json({
        success: true,
        data: { isBookmarked: await isBookmarked(userId, arxivId) },
      });
    }

    return NextResponse.json({ success: true, data: await listBookmarks(userId, 30) });
  } catch (error) {
    console.error('Get bookmarks error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to fetch bookmarks.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = await ensureSessionUser({
      id: session?.user?.id,
      email: session?.user?.email,
      name: session?.user?.name,
      image: session?.user?.image,
    });
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bookmarkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid bookmark payload.' },
        { status: 400 }
      );
    }

    await upsertBookmark(userId, parsed.data);
    void trackRequestEvent(request, {
      eventName: 'bookmark_created',
      arxivId: parsed.data.arxivId,
      title: parsed.data.title,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bookmark create error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to save bookmark.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const user = await ensureSessionUser({
      id: session?.user?.id,
      email: session?.user?.email,
      name: session?.user?.name,
      image: session?.user?.image,
    });
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const arxivId = searchParams.get('arxivId');

    if (!arxivId) {
      return NextResponse.json(
        { success: false, error: 'arXiv ID is required.' },
        { status: 400 }
      );
    }

    await removeBookmark(userId, arxivId);
    void trackRequestEvent(request, {
      eventName: 'bookmark_removed',
      arxivId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Bookmark delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to remove bookmark.' },
      { status: 500 }
    );
  }
}
