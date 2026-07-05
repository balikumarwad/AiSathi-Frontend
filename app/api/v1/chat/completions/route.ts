/**
 * The product core: an OpenAI-compatible chat completions endpoint.
 *
 * Flow: authenticate SathiAI key -> check NPR balance -> forward to upstream
 * (OpenRouter) -> meter usage -> atomically deduct credits -> log -> respond
 * with the upstream JSON plus a `nepalai: { cost_npr, balance_npr }` block.
 *
 * Dev mode: a request bearing NEPALAI_DEV_KEY skips the database entirely so
 * the gateway is testable before Supabase is configured. Remove in prod.
 */

import { NextResponse } from "next/server";
import { bearerFrom, hashApiKey } from "@/lib/keys";
import { usdToNpr, round4 } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upstreamChat, upstreamModels } from "@/lib/upstream";

export const runtime = "nodejs";

type KeyContext =
  | { mode: "dev" }
  | { mode: "db"; userId: string; keyId: string };

async function authenticate(req: Request): Promise<KeyContext | NextResponse> {
  const token = bearerFrom(req);
  if (!token) {
    return NextResponse.json(
      { error: { message: "Missing Authorization: Bearer <api key>", code: 401 } },
      { status: 401 },
    );
  }
  const devKey = process.env.NEPALAI_DEV_KEY;
  if (devKey && token === devKey) return { mode: "dev" };

  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: { message: "Gateway database not configured", code: 503 } },
      { status: 503 },
    );
  }
  const { data: keyRow } = await db
    .from("api_keys")
    .select("id, user_id, active")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();
  if (!keyRow || !keyRow.active) {
    return NextResponse.json(
      { error: { message: "Invalid or revoked API key", code: 401 } },
      { status: 401 },
    );
  }
  return { mode: "db", userId: keyRow.user_id, keyId: keyRow.id };
}

/** Estimate upstream USD cost from token counts when upstream omits `cost`. */
async function estimateUsd(model: string, promptTok: number, completionTok: number) {
  try {
    const models = (await upstreamModels()) as Array<{
      id: string;
      pricing?: { prompt?: string; completion?: string };
    }>;
    const m = models.find((x) => x.id === model);
    if (!m?.pricing) return 0;
    return (
      promptTok * (Number(m.pricing.prompt) || 0) +
      completionTok * (Number(m.pricing.completion) || 0)
    );
  } catch {
    return 0;
  }
}

export async function POST(req: Request) {
  const auth = await authenticate(req);
  if (auth instanceof NextResponse) return auth;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON body", code: 400 } },
      { status: 400 },
    );
  }
  if (!body.model || !Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: { message: "`model` and `messages` are required", code: 400 } },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();

  // Balance gate (db mode only).
  if (auth.mode === "db" && db) {
    const { data: bal, error } = await db.rpc("credit_balance", { p_user: auth.userId });
    if (error) {
      return NextResponse.json(
        { error: { message: "Balance check failed", code: 500 } },
        { status: 500 },
      );
    }
    if (Number(bal) <= 0) {
      return NextResponse.json(
        {
          error: {
            message: "Insufficient credits. Top up your SathiAI balance.",
            code: 402,
          },
          balance_npr: Number(bal),
        },
        { status: 402 },
      );
    }
  }

  // MVP is non-streaming: metering stays trivially correct.
  const upstreamBody = { ...body, stream: false, usage: { include: true } };

  let upstream: Response;
  try {
    upstream = await upstreamChat(upstreamBody);
  } catch (e) {
    return NextResponse.json(
      { error: { message: `Upstream unreachable: ${String(e)}`, code: 502 } },
      { status: 502 },
    );
  }

  const payload = await upstream.json().catch(() => null);

  if (!upstream.ok || !payload) {
    // Upstream failed: no charge; log for observability.
    if (auth.mode === "db" && db) {
      await db.from("usage_log").insert({
        user_id: auth.userId,
        api_key_id: auth.keyId,
        model: String(body.model),
        status: "upstream_error",
      });
    }
    return NextResponse.json(
      payload ?? { error: { message: "Upstream error", code: upstream.status } },
      { status: upstream.status || 502 },
    );
  }

  // ---- Metering ----
  const usage = payload.usage ?? {};
  const promptTok = Number(usage.prompt_tokens) || 0;
  const completionTok = Number(usage.completion_tokens) || 0;
  const upstreamUsd =
    Number(usage.cost) || (await estimateUsd(String(body.model), promptTok, completionTok));
  const costNpr = usdToNpr(upstreamUsd);

  let balanceNpr: number | null = null;
  if (auth.mode === "db" && db) {
    const { data: newBal, error: dedErr } = await db.rpc("deduct_credits", {
      p_user: auth.userId,
      p_amount_npr: costNpr,
      p_meta: { model: body.model, prompt_tokens: promptTok, completion_tokens: completionTok },
    });
    if (dedErr) {
      // Race: balance ran out between the gate and the deduction.
      return NextResponse.json(
        { error: { message: "Insufficient credits", code: 402 } },
        { status: 402 },
      );
    }
    balanceNpr = round4(Number(newBal));
    await db.from("usage_log").insert({
      user_id: auth.userId,
      api_key_id: auth.keyId,
      model: String(body.model),
      prompt_tokens: promptTok,
      completion_tokens: completionTok,
      upstream_cost_usd: upstreamUsd,
      cost_npr: costNpr,
      status: "ok",
    });
    await db
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", auth.keyId);
  }

  return NextResponse.json({
    ...payload,
    nepalai: { cost_npr: costNpr, balance_npr: balanceNpr, dev_mode: auth.mode === "dev" },
  });
}
