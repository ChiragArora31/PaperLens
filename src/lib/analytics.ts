import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { cookies, headers } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { ensureSessionUser, trackAnalyticsEvent, type AnalyticsEventInput } from './db';

export const ANALYTICS_COOKIE = 'paperlens_visitor_id';

export function createVisitorId(): string {
  return `anon_${randomUUID()}`;
}

export function trafficSource(referrer?: string | null): string {
  if (!referrer) return 'Direct / unknown';
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '');
    if (host.includes('paperlens.in')) return 'PaperLens';
    if (host.includes('google.')) return 'Google';
    if (host.includes('twitter.com') || host.includes('x.com')) return 'X / Twitter';
    if (host.includes('linkedin.com')) return 'LinkedIn';
    if (host.includes('github.com')) return 'GitHub';
    if (host.includes('reddit.com')) return 'Reddit';
    if (host.includes('news.ycombinator.com')) return 'Hacker News';
    return host;
  } catch {
    return 'Direct / unknown';
  }
}

export function getVisitorIdFromRequest(request: NextRequest): string | null {
  return request.cookies.get(ANALYTICS_COOKIE)?.value ?? null;
}

export async function getVisitorIdFromCookies(): Promise<string | null> {
  const store = await cookies();
  return store.get(ANALYTICS_COOKIE)?.value ?? null;
}

export async function trackRequestEvent(
  request: NextRequest,
  input: Omit<AnalyticsEventInput, 'anonymousId' | 'path' | 'referrer' | 'source'>
) {
  try {
    const session = await getServerSession(authOptions);
    const user = ensureSessionUser({
      id: session?.user?.id,
      email: session?.user?.email,
      name: session?.user?.name,
      image: session?.user?.image,
    });
    const referrer = request.headers.get('referer');
    trackAnalyticsEvent({
      ...input,
      userId: user?.id ?? null,
      anonymousId: getVisitorIdFromRequest(request),
      path: request.nextUrl.pathname,
      referrer,
      source: trafficSource(referrer),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Analytics event skipped:', error);
    }
  }
}

export async function trackServerEvent(input: AnalyticsEventInput) {
  try {
    const headerStore = await headers();
    const referrer = input.referrer ?? headerStore.get('referer');
    trackAnalyticsEvent({
      ...input,
      referrer,
      source: input.source ?? trafficSource(referrer),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Analytics event skipped:', error);
    }
  }
}
