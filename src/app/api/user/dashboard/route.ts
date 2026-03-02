import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ensureSessionUser, listBookmarks, listRecentPapers } from '@/lib/db';
import { fetchRecommendedPapers } from '@/lib/recommendations';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const user = ensureSessionUser({
      id: session?.user?.id,
      email: session?.user?.email,
      name: session?.user?.name,
      image: session?.user?.image,
    });
    const userId = user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const recents = listRecentPapers(userId, 20);
    const bookmarks = listBookmarks(userId, 20);

    const seedCategories = Array.from(
      new Set([...bookmarks, ...recents].flatMap((paper) => paper.categories).filter(Boolean))
    );

    const excludeIds = Array.from(new Set([...bookmarks, ...recents].map((paper) => paper.arxivId)));

    // Only produce recommendations when we have user-derived signals.
    const recommendations =
      seedCategories.length > 0
        ? await fetchRecommendedPapers(seedCategories, excludeIds, 6)
        : [];

    return NextResponse.json({
      success: true,
      data: {
        recents,
        bookmarks,
        recommendations,
      },
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load personalized dashboard right now.' },
      { status: 500 }
    );
  }
}
