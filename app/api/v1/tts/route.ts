/**
 * Pro voice tier (LibreChat speech-config pattern): natural TTS via a
 * swappable provider, gated to signed-in users with credit. The free browser
 * voice remains the client-side fallback, so this endpoint being disabled
 * (no TTS_API_KEY yet — an Oscar launch decision) degrades gracefully.
 *
 * Env config (all optional until launch):
 *   TTS_PROVIDER      'elevenlabs' (default) | 'openai' (any OpenAI-compatible)
 *   TTS_API_KEY       provider key — endpoint returns 503 until set
 *   TTS_API_URL       override base URL (defaults per provider)
 *   TTS_MODEL         default: eleven_multilingual_v2 / tts-1
 *   TTS_VOICE_ID      default: pFZP5JQG7iQjIQuC4Bku (Lily, multilingual) / alloy
 *   TTS_PRICE_NPR_PER_1K  chars price charged to the user (default 0 = free)
 */

import { NextResponse } from "next/server";
import { bearerFrom, hashApiKey } from "@/lib/keys";
import { allowAsync } from "@/lib/ratelimit";
import { round4 } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 800;

export async function POST(req: Request) {
  const apiKey = process.env.TTS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { disabled: true, error: { message: "Pro voice is not enabled yet", code: 503 } },
      { status: 503 },
    );
  }

  const token = bearerFrom(req);
  if (!token || token === "demo") {
    return NextResponse.json(
      { error: { message: "Pro voice needs a signed-in account", code: 401 } },
      { status: 401 },
    );
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: { message: "db not configured", code: 503 } }, { status: 503 });
  const { data: keyRow } = await db
    .from("api_keys")
    .select("id, user_id, active")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();
  if (!keyRow || !keyRow.active) {
    return NextResponse.json({ error: { message: "Invalid API key", code: 401 } }, { status: 401 });
  }

  // Pro gate: needs credit on the account + a sane daily cap.
  const { data: bal } = await db.rpc("credit_balance", { p_user: keyRow.user_id });
  if (!(Number(bal) > 0)) {
    return NextResponse.json(
      { error: { message: "Pro voice needs credits — top up to unlock natural voices", code: 402 } },
      { status: 402 },
    );
  }
  if (!(await allowAsync(`tts:${keyRow.user_id}`, 60, 24 * 3_600_000))) {
    return NextResponse.json(
      { error: { message: "Daily Pro voice limit reached", code: 429 } },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = String(body?.text ?? "").trim().slice(0, MAX_CHARS);
  if (text.length < 2) {
    return NextResponse.json({ error: { message: "text required", code: 400 } }, { status: 400 });
  }

  const provider = process.env.TTS_PROVIDER || "elevenlabs";
  let upstream: Response;
  try {
    if (provider === "elevenlabs") {
      const base = process.env.TTS_API_URL || "https://api.elevenlabs.io";
      const voice = process.env.TTS_VOICE_ID || "pFZP5JQG7iQjIQuC4Bku";
      const model = process.env.TTS_MODEL || "eleven_multilingual_v2";
      upstream = await fetch(`${base}/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ text, model_id: model }),
      });
    } else {
      // Any OpenAI-compatible /v1/audio/speech provider.
      const base = process.env.TTS_API_URL || "https://api.openai.com";
      upstream = await fetch(`${base}/v1/audio/speech`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.TTS_MODEL || "tts-1",
          voice: process.env.TTS_VOICE_ID || "alloy",
          input: text,
        }),
      });
    }
  } catch (e) {
    return NextResponse.json({ error: { message: `TTS upstream unreachable: ${String(e)}`, code: 502 } }, { status: 502 });
  }
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: { message: "TTS provider error", code: upstream.status } }, { status: 502 });
  }

  // Bill per character when a price is configured; always log usage.
  const priceNpr = round4(((Number(process.env.TTS_PRICE_NPR_PER_1K) || 0) * text.length) / 1000);
  if (priceNpr > 0) {
    await db.from("credit_transactions").insert({
      user_id: keyRow.user_id,
      amount_npr: -priceNpr,
      kind: "usage",
      meta: { model: `tts/${provider}`, chars: text.length },
    });
  }
  await db.from("usage_log").insert({
    user_id: keyRow.user_id,
    api_key_id: keyRow.id,
    model: `tts/${provider}`,
    cost_npr: priceNpr,
    status: "ok",
  });

  return new Response(upstream.body, {
    status: 200,
    headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
  });
}
