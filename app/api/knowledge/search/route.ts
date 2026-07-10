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

    const { data, error } = await db.rpc("match_knowledge", {
      query_embedding: ej.data[0].embedding,
      match_count: 3,
      min_similarity: 0.35,
    });
    if (error) return NextResponse.json({ matches: [] });
    return NextResponse.json({ matches: data ?? [] });
  } catch {
    return NextResponse.json({ matches: [] });
  }
}
