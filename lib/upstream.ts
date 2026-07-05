/**
 * Upstream provider = OpenRouter. One place holds the URL + key so we can
 * swap or add upstreams later (direct OpenAI, GLM, ...) without touching
 * the gateway route.
 */

const UPSTREAM_URL = "https://openrouter.ai/api/v1";

export function upstreamHeaders(): HeadersInit {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY is not set");
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    // OpenRouter attribution headers (shows in their rankings, free marketing)
    "HTTP-Referer": process.env.NEPALAI_SITE_URL ?? "http://localhost:3000",
    "X-Title": "SathiAI",
  };
}

export async function upstreamChat(body: unknown): Promise<Response> {
  return fetch(`${UPSTREAM_URL}/chat/completions`, {
    method: "POST",
    headers: upstreamHeaders(),
    body: JSON.stringify(body),
  });
}

/** Model catalog, cached in-memory for 10 minutes per server instance. */
let modelsCache: { at: number; data: unknown[] } | null = null;

export async function upstreamModels(): Promise<unknown[]> {
  if (modelsCache && Date.now() - modelsCache.at < 10 * 60_000) {
    return modelsCache.data;
  }
  const res = await fetch(`${UPSTREAM_URL}/models`);
  if (!res.ok) throw new Error(`upstream /models failed: ${res.status}`);
  const json = await res.json();
  modelsCache = { at: Date.now(), data: json.data ?? [] };
  return modelsCache.data;
}
