/**
 * Minimal sliding-window rate limiter (per serverless instance). Not a
 * distributed limiter — Vercel runs multiple instances — but it caps abuse
 * cheaply with zero dependencies; a hot attacker hits the same warm instance.
 */

const windows = new Map<string, number[]>();

/** Returns true when the caller is within `limit` events per `windowMs`. */
export function allow(id: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (windows.get(id) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    windows.set(id, hits);
    return false;
  }
  hits.push(now);
  windows.set(id, hits);
  // Opportunistic cleanup so the map can't grow unbounded.
  if (windows.size > 10_000) {
    for (const [k, v] of windows) if (v.every((t) => t <= cutoff)) windows.delete(k);
  }
  return true;
}
