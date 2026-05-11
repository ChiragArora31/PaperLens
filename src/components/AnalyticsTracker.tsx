'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const query = searchParams.toString();
    const path = query ? `${pathname}?${query}` : pathname;

    void fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventName: 'page_view',
        path,
        referrer: document.referrer || undefined,
      }),
      keepalive: true,
    }).catch(() => {
      // Analytics should never block navigation or product usage.
    });
  }, [pathname, searchParams]);

  return null;
}
