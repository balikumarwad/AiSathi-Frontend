/**
 * Reply feedback (thumbs up / down) — the training-data flywheel.
 *
 * Every vote stores the question, the answer, the model, and who voted.
 * Signed-in votes double as entries in the monthly रू1,000 lucky draw;
 * anonymous (demo) votes are stored too but flagged, since a winner needs an
 * account to be paid. Data is written with the service role only — there are
 * no public RLS policies on the table.
 */

import { NextResponse } from "next/server";
import { bearerFrom, hashApiKey } from "@/lib/keys";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { allowAsync } from "@/lib/ratelimit";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export async function POST(req: Request) {
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const token = bearerFrom(req);
  let userId: string | null = null;
  let keyId: string | null = null;
  if (token && token !== "demo") {
    const { data } = await db
      .from("api_keys")
      .select("id, user_id, active")
      .eq("key_hash", hashApiKey(token))
      .maybeSingle();
    if (data && data.active) {
      userId = data.user_id as string;
      keyId = data.id as string;
    }
  }

  // One identity can't stuff the draw: 30 votes/hour per user or IP.
  const rlId = userId ?? `ip:${clientIp(req)}`;
  if (!(await allowAsync(`fb:${rlId}`, 30, 3_600_000))) {
    return NextResponse.json({ error: "Too many votes — try again later." }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as {
    vote?: string; model?: string; question?: string; answer?: string; chat_id?: string; msg_index?: number;
  } | null;
  if (!body || (body.vote !== "up" && body.vote !== "down")) {
    return NextResponse.json({ error: "vote must be 'up' or 'down'" }, { status: 400 });
  }

  const { error } = await db.from("feedback").insert({
    user_id: userId,
    api_key_id: keyId,
    anonymous: !userId,
    model: String(body.model ?? "").slice(0, 120),
    question: String(body.question ?? "").slice(0, 4000),
    answer: String(body.answer ?? "").slice(0, 8000),
    vote: body.vote,
    chat_id: String(body.chat_id ?? "").slice(0, 64),
    msg_index: Number.isFinite(Number(body.msg_index)) ? Number(body.msg_index) : null,
  });
  if (error) {
    return NextResponse.json({ error: "Could not save feedback" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, draw_entry: !!userId });
}
