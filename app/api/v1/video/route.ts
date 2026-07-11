/**
 * Text-to-video generation, backed by Replicate.
 *
 * Video is slow (30s–2min) and generated asynchronously, so this route is a
 * thin proxy around Replicate's prediction API:
 *   POST  { prompt }        -> creates a prediction, returns { id, status }
 *   GET   ?id=<predictionId> -> returns { status, url?, error? }
 * The client submits once, then polls GET until the status is terminal.
 *
 * The Replicate token stays server-side. Video costs real money per clip
 * (billed to the token owner's Replicate account), so generation is gated to
 * signed-in users with a valid AIsathi key and rate-limited per key.
 */

import { NextResponse } from "next/server";
import { bearerFrom, hashApiKey } from "@/lib/keys";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { allowAsync } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 300; // Pro: headroom for slow provider responses

const REPLICATE = "https://api.replicate.com/v1";
// seedance-1-lite: the most-run text-to-video model on Replicate — cheap,
// fast, and reliable. Change here to swap the whole platform's video model.
const MODEL = "bytedance/seedance-1-lite";
const DAILY_LIMIT = 8; // videos per key per day (protects the Replicate bill)

/** Resolve a Bearer AIsathi key to its key id, or null if invalid/inactive. */
async function authKeyId(req: Request): Promise<string | null> {
  const token = bearerFrom(req);
  if (!token) return null;
  const db = supabaseAdmin();
  if (!db) return null;
  const { data } = await db
    .from("api_keys")
    .select("id, active")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();
  return data && data.active ? (data.id as string) : null;
}

export async function POST(req: Request) {
  const rtok = process.env.REPLICATE_API_TOKEN;
  if (!rtok) {
    return NextResponse.json({ error: "Video generation isn't configured yet." }, { status: 503 });
  }

  const keyId = await authKeyId(req);
  if (!keyId) {
    return NextResponse.json({ error: "Sign in to generate video." }, { status: 401 });
  }
  if (!(await allowAsync(`video:${keyId}`, DAILY_LIMIT, 24 * 60 * 60 * 1000))) {
    return NextResponse.json(
      { error: `Daily video limit reached (${DAILY_LIMIT}/day). Try again tomorrow.` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = String(body.prompt ?? "").trim().slice(0, 800);
  if (!prompt) {
    return NextResponse.json({ error: "A prompt is required." }, { status: 400 });
  }

  const r = await fetch(`${REPLICATE}/models/${MODEL}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${rtok}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: { prompt, duration: 5, resolution: "480p", aspect_ratio: "16:9" } }),
  });

  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    // 402 = the video provider account has no credit / payment method.
    const msg =
      r.status === 402
        ? "Video generation is temporarily unavailable (the video provider account needs billing set up)."
        : `Video provider error (${r.status}). ${detail.slice(0, 200)}`.trim();
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const p = (await r.json()) as { id: string; status: string };
  return NextResponse.json({ id: p.id, status: p.status });
}

export async function GET(req: Request) {
  const rtok = process.env.REPLICATE_API_TOKEN;
  if (!rtok) {
    return NextResponse.json({ error: "Video generation isn't configured yet." }, { status: 503 });
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "A prediction id is required." }, { status: 400 });
  }

  const r = await fetch(`${REPLICATE}/predictions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${rtok}` },
  });
  if (!r.ok) {
    return NextResponse.json({ error: "Could not check video status." }, { status: 502 });
  }

  const p = (await r.json()) as { status: string; output?: unknown; error?: unknown };
  const url = Array.isArray(p.output) ? (p.output[0] as string) : (p.output as string | undefined);
  return NextResponse.json({
    status: p.status,
    url: url ?? null,
    error: p.error ? String(p.error) : null,
  });
}
