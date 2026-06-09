import "server-only";

import { NextResponse } from "next/server";

/**
 * Lightweight in-memory rate limiter — a fixed-window counter keyed by
 * arbitrary identifier (typically `${ip}:${route}`). Returns the
 * remaining budget so callers can surface friendly errors.
 *
 * Trade-offs:
 *   - Per-instance (memory only). On a multi-region serverless deploy
 *     each instance has its own counter, so the true cap is
 *     `limit * instances`. This is BEST-EFFORT — it stops casual
 *     scripts and bots, not a distributed botnet.
 *   - Migrate to Upstash Ratelimit / Vercel KV when we need durable +
 *     distributed limits (post-MVP).
 *
 * Memory hygiene: a single Map can grow unbounded if we receive
 * traffic from many distinct keys. A naive GC sweeps stale entries
 * every `GC_INTERVAL_MS`. With reasonable traffic this is fine; under
 * a deliberate cache-poisoning attack the GC would eventually catch up
 * since each evictee weighs ~50 bytes.
 */

type Bucket = {
  count: number;
  /** Epoch ms when this bucket resets. */
  resetAt: number;
};

const BUCKETS = new Map<string, Bucket>();
const GC_INTERVAL_MS = 5 * 60 * 1000;
let lastGc = 0;

function gc(now: number): void {
  if (now - lastGc < GC_INTERVAL_MS) return;
  for (const [k, b] of BUCKETS) {
    if (b.resetAt < now) BUCKETS.delete(k);
  }
  lastGc = now;
}

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | { ok: false; retryAfterSeconds: number; resetAt: number };

/**
 * Consume one token from the bucket identified by `key`.
 *
 * @param key      Unique identifier (e.g. `${ip}:forgot-password`).
 * @param limit    Maximum requests per window.
 * @param windowMs Window length in milliseconds.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  gc(now);

  const existing = BUCKETS.get(key);
  if (!existing || existing.resetAt < now) {
    BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000),
      ),
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: Math.max(0, limit - existing.count),
    resetAt: existing.resetAt,
  };
}

/**
 * Extract a best-effort client identifier from request headers. Prefers
 * forwarded headers (set by Vercel / proxies) and falls back to a
 * synthetic key when none are present so localhost dev still works.
 */
export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    // First IP in the chain is the original client; subsequent entries
    // are intermediate proxies.
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}

/**
 * Convenience wrapper for the common pattern of "rate-limit by IP +
 * route name; return a 429 with Retry-After when over". Returns null
 * when the request is allowed.
 */
export function enforceRateLimit(
  req: Request,
  routeKey: string,
  limit: number,
  windowMs: number,
): NextResponse | null {
  const ip = clientKey(req);
  const result = checkRateLimit(`${ip}:${routeKey}`, limit, windowMs);
  if (result.ok) return null;

  return NextResponse.json(
    {
      error: "Too many requests. Please try again shortly.",
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}
