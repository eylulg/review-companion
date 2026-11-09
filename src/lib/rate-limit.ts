interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}

/**
 * Fixed-window counter per key, kept in memory. On a serverless host each instance has its own
 * window, so this is a guard against casual abuse rather than a hard quota.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
    const windows = new Map<string, { start: number; count: number }>();

    return function check(key: string): RateLimitResult {
        const time = now();
        // Drop expired windows so the map does not grow without bound.
        if (windows.size > 5000) {
            for (const [entryKey, entry] of windows) if (time - entry.start >= windowMs) windows.delete(entryKey);
        }

        const entry = windows.get(key);
        if (!entry || time - entry.start >= windowMs) {
            windows.set(key, { start: time, count: 1 });
            return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
        }
        if (entry.count >= limit) {
            return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil((entry.start + windowMs - time) / 1000) };
        }
        entry.count += 1;
        return { allowed: true, remaining: limit - entry.count, retryAfterSeconds: 0 };
    };
}

/** Client IP from the proxy headers set by the host (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
    const forwarded = headers.get("x-forwarded-for");
    const first = forwarded?.split(",")[0]?.trim();
    if (first) return first;
    return headers.get("x-real-ip") ?? "unknown";
}
