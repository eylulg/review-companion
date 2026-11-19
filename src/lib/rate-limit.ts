interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

interface Reservation extends RateLimitResult {
  /** Call once when the request is over. Only a request that got a successful model answer uses up the allowance. */
  settle: (counted: boolean) => void;
}

/**
 * Fixed-window counter per key, kept in memory. A request reserves a slot while it runs, so parallel
 * requests cannot all slip under the limit, but only requests that settle as counted use the allowance
 * up: a review that fails before the model answers costs the visitor nothing. On a serverless host each
 * instance has its own window, so this is a guard against casual abuse rather than a hard quota.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number; pending: number }>();

  function liveWindow(key: string, time: number) {
    const entry = windows.get(key);
    if (entry && time - entry.start < windowMs) return entry;
    const fresh = { start: time, count: 0, pending: entry?.pending ?? 0 };
    windows.set(key, fresh);
    return fresh;
  }

  return function reserve(key: string): Reservation {
    const time = now();
    // Drop idle expired windows so the map does not grow without bound.
    if (windows.size > 5000) {
      for (const [entryKey, entry] of windows)
        if (entry.pending === 0 && time - entry.start >= windowMs) windows.delete(entryKey);
    }

    const entry = liveWindow(key, time);
    if (entry.count + entry.pending >= limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.ceil((entry.start + windowMs - time) / 1000),
        settle: () => {},
      };
    }

    entry.pending += 1;
    let settled = false;
    return {
      allowed: true,
      remaining: limit - entry.count - entry.pending,
      retryAfterSeconds: 0,
      settle: (counted) => {
        if (settled) return;
        settled = true;
        const current = liveWindow(key, now());
        current.pending -= 1;
        if (counted) current.count += 1;
      },
    };
  };
}

/** Client IP from the proxy headers. Only trustworthy behind a host that overwrites them (Vercel does); see the README. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;
  return headers.get('x-real-ip') ?? 'unknown';
}
