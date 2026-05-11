import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { ANALYTICS_COOKIE, createVisitorId, trafficSource } from '@/lib/analytics';
import { ensureSessionUser, trackAnalyticsEvent } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const eventSchema = z.object({
  eventName: z.string().min(1).max(80),
  arxivId: z.string().max(80).optional(),
  title: z.string().max(500).optional(),
  path: z.string().max(500).optional(),
  referrer: z.string().max(500).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = eventSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: 'Invalid analytics event.' }, { status: 400 });
    }

    const session = await getServerSession(authOptions);
    const user = ensureSessionUser({
      id: session?.user?.id,
      email: session?.user?.email,
      name: session?.user?.name,
      image: session?.user?.image,
    });

    const existingVisitorId = request.cookies.get(ANALYTICS_COOKIE)?.value;
    const visitorId = existingVisitorId || createVisitorId();
    const referrer = parsed.data.referrer || request.headers.get('referer');

    trackAnalyticsEvent({
      eventName: parsed.data.eventName,
      userId: user?.id ?? null,
      anonymousId: visitorId,
      arxivId: parsed.data.arxivId,
      title: parsed.data.title,
      path: parsed.data.path || request.nextUrl.pathname,
      referrer,
      source: trafficSource(referrer),
      metadata: parsed.data.metadata,
    });

    const response = NextResponse.json({ success: true });
    if (!existingVisitorId) {
      response.cookies.set(ANALYTICS_COOKIE, visitorId, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 400,
        path: '/',
      });
    }
    return response;
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Analytics event skipped:', error);
    }
    return NextResponse.json({ success: true, skipped: true });
  }
}
