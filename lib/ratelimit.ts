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

/**
 * Hand back one hit previously counted by allowAsync() for the same id and
 * window — for quotas that should only count requests that actually got
 * served (an upstream failure must not burn a user's daily free cap).
 * Best-effort: a failed release just leaves the hit counted.
 */
export async function release(id: string, windowMs: number): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    windows.get(id)?.pop();
    return;
  }
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["DECR", `rl:${id}:${windowSec}`]]),
    });
  } catch {
    /* best-effort */
  }
}

/**
 * Distributed rate limit backed by Upstash Redis (fixed window). Real limits
 * that hold across all serverless instances. Falls back to the in-memory
 * limiter above when Upstash isn't configured or a request fails, so the
 * gateway never breaks — it just degrades to per-instance limits.
 *
 * Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN to enable.
 */
export async function allowAsync(id: string, limit: number, windowMs: number): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return allow(id, limit, windowMs);
  const windowSec = Math.max(1, Math.ceil(windowMs / 1000));
  const key = `rl:${id}:${windowSec}`;
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      // INCR the counter, and set the TTL only if the key is new (NX) so the
      // window starts on the first hit.
      body: JSON.stringify([["INCR", key], ["EXPIRE", key, windowSec, "NX"]]),
    });
    if (!res.ok) return allow(id, limit, windowMs);
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    return count > 0 ? count <= limit : allow(id, limit, windowMs);
  } catch {
    return allow(id, limit, windowMs);
  }
}
