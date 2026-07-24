/**
 * Resumable-stream buffer backed by Upstash Redis (REST).
 *
 * While an answer streams, the gateway mirrors the accumulated text here so a
 * client whose connection dropped (mobile networks!) can re-attach and keep
 * reading instead of losing the reply. Records are small JSON blobs with a
 * short TTL — this is a reconnect window, not storage.
 *
 * Uses the same UPSTASH_REDIS_REST_URL/TOKEN as the rate limiter; when they're
 * absent every helper is a no-op and streaming behaves exactly as before.
 */

export type StreamState = {
  /** sha256 of the bearer token that started the stream — resume must match. */
  owner: string;
  /** Full assistant text accumulated so far. */
  text: string;
  done: boolean;
  /** Billing block (cost_npr, balance_npr, …) — present once done. */
  nepalai?: Record<string, unknown> | null;
  error?: string;
};

const TTL_SEC = 600; // 10 min reconnect window

function redisEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export function streamStoreEnabled(): boolean {
  return !!redisEnv();
}

/** One id is one stream; ids come from the client and must be unguessable. */
export function validStreamId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9-]{16,64}$/.test(id);
}

async function redisPipeline(cmds: unknown[][]): Promise<Array<{ result?: unknown }> | null> {
  const env = redisEnv();
  if (!env) return null;
  try {
    const res = await fetch(`${env.url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
    });
    if (!res.ok) return null;
    return (await res.json()) as Array<{ result?: unknown }>;
  } catch {
    return null;
  }
}

/**
 * Write the current state and report whether an abort was requested by the
 * client (user pressed stop after disconnecting) — one round trip for both.
 */
export async function streamWrite(id: string, state: StreamState): Promise<{ aborted: boolean }> {
  const out = await redisPipeline([
    ["SET", `stream:${id}`, JSON.stringify(state), "EX", String(TTL_SEC)],
    ["GET", `stream:${id}:abort`],
  ]);
  return { aborted: !!out?.[1]?.result };
}

export async function streamRead(id: string): Promise<StreamState | null> {
  const out = await redisPipeline([["GET", `stream:${id}`]]);
  const raw = out?.[0]?.result;
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as StreamState;
  } catch {
    return null;
  }
}

/** Ask a running (possibly client-less) stream to stop generating. */
export async function streamAbort(id: string): Promise<void> {
  await redisPipeline([["SET", `stream:${id}:abort`, "1", "EX", String(TTL_SEC)]]);
}
