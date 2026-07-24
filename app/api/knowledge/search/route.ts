/**
 * RAG retrieval over the Nepal knowledge base. Embeds the query with
 * text-embedding-3-small via OpenRouter (~$0.00002/query) and returns the
 * top cosine matches via the match_knowledge SQL function. Open to demo and
 * signed-in traffic alike (the knowledge is public info); rate-limited per IP.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upstreamHeaders } from "@/lib/upstream";
import { allowAsync } from "@/lib/ratelimit";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ matches: [] });

  if (!(await allowAsync(`kn:${clientIp(req)}`, 30, 60_000))) {
    return NextResponse.json({ matches: [] }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { q?: string } | null;
  const q = String(body?.q ?? "").trim().slice(0, 500);
  if (q.length < 8) return NextResponse.json({ matches: [] });

  try {
    const emb = await fetch("https://openrouter.ai/api/v1/embeddings", {
      method: "POST",
      headers: upstreamHeaders(),
      body: JSON.stringify({ model: "openai/text-embedding-3-small", input: q }),
    });
    if (!emb.ok) return NextResponse.json({ matches: [] });
    const ej = (await emb.json()) as { data: { embedding: number[] }[] };

    // LibreChat-style citation quality controls (env-tunable, no redeploy of
    // logic needed): a stricter relevance floor keeps weak matches from being
    // injected as "verified facts", and a per-source cap stops one document
    // from crowding out the rest.
    const minSim = Number(process.env.RAG_MIN_SIMILARITY) || 0.45;
    const matchCount = Number(process.env.RAG_MATCH_COUNT) || 3;
    const maxPerSource = Number(process.env.RAG_MAX_PER_SOURCE) || 2;

    const { data, error } = await db.rpc("match_knowledge", {
      query_embedding: ej.data[0].embedding,
      match_count: matchCount * 3, // headroom so per-source capping can't starve results
      min_similarity: minSim,
    });
    if (error) return NextResponse.json({ matches: [] });

    const perSource = new Map<string, number>();
    const matches = ((data ?? []) as Array<{ source?: string }>).filter((m) => {
      const src = m.source ?? "";
      const n = (perSource.get(src) ?? 0) + 1;
      perSource.set(src, n);
      return n <= maxPerSource;
    }).slice(0, matchCount);

    return NextResponse.json({ matches });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
