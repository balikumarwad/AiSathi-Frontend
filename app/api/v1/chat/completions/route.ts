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

/** Free tier: models whose upstream price is $0 are usable with an empty balance. */
async function isFreeModel(model: string) {
  try {
    const models = (await upstreamModels()) as Array<{
      id: string;
      pricing?: { prompt?: string; completion?: string };
    }>;
    const m = models.find((x) => x.id === model);
    return (
      !!m && (Number(m.pricing?.prompt) || 0) === 0 && (Number(m.pricing?.completion) || 0) === 0
    );
  } catch {
    return false;
  }
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
    if (Number(bal) <= 0 && !(await isFreeModel(String(body.model)))) {
      return NextResponse.json(
        {
          error: {
            message:
              "Insufficient credits. Top up your SathiAI balance — or use a free model (रू0/M in the catalog).",
            code: 402,
          },
          balance_npr: Number(bal),
        },
        { status: 402 },
      );
    }
  }

  const wantStream = body.stream === true;
  const upstreamBody = { ...body, stream: wantStream, usage: { include: true } };

  let upstream: Response;
  try {
    upstream = await upstreamChat(upstreamBody);
  } catch (e) {
    return NextResponse.json(
      { error: { message: `Upstream unreachable: ${String(e)}`, code: 502 } },
      { status: 502 },
    );
  }

  // ---- Streaming path: relay SSE bytes live, bill from the final usage chunk ----
  if (wantStream && upstream.ok && upstream.body) {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = "";
    let usage: Record<string, unknown> | null = null;
    let billed = false;

    // Billing runs exactly once — either when we see [DONE] (so we can inject
    // the cost event before it) or in flush() as a safety net on abrupt ends.
    const bill = async (): Promise<Record<string, unknown> | null> => {
      if (billed) return null;
      billed = true;
      const promptTok = Number(usage?.prompt_tokens) || 0;
      const completionTok = Number(usage?.completion_tokens) || 0;
      const upstreamUsd =
        Number(usage?.cost) ||
        (usage ? await estimateUsd(String(body.model), promptTok, completionTok) : 0);
      const costNpr = usdToNpr(upstreamUsd);
      let balanceNpr: number | null = null;
      if (auth.mode === "db" && db && usage) {
        let dedErr = null;
        if (costNpr > 0) {
          const { data: newBal, error } = await db.rpc("deduct_credits", {
            p_user: auth.userId,
            p_amount_npr: costNpr,
            p_meta: { model: body.model, prompt_tokens: promptTok, completion_tokens: completionTok, stream: true },
          });
          dedErr = error;
          if (!dedErr) balanceNpr = round4(Number(newBal));
        }
        await db.from("usage_log").insert({
          user_id: auth.userId,
          api_key_id: auth.keyId,
          model: String(body.model),
          prompt_tokens: promptTok,
          completion_tokens: completionTok,
          upstream_cost_usd: upstreamUsd,
          cost_npr: costNpr,
          status: dedErr ? "deduct_failed" : "ok",
        });
        await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", auth.keyId);
      }
      return { cost_npr: costNpr, balance_npr: balanceNpr, dev_mode: auth.mode === "dev" };
    };

    const transform = new TransformStream<Uint8Array, Uint8Array>({
      async transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6).trim();
            if (data === "[DONE]") {
              // Bill BEFORE releasing [DONE]; tell the client what it cost.
              const info = await bill();
              if (info) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ nepalai: info })}\n\n`));
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const j = JSON.parse(data);
              if (j.usage) usage = j.usage; // final chunk carries usage + cost
            } catch {
              /* partial/non-JSON line — pass through */
            }
          }
          controller.enqueue(encoder.encode(line + "\n"));
        }
      },
      async flush(controller) {
        if (buffer) controller.enqueue(encoder.encode(buffer));
        await bill(); // abrupt end without [DONE]: still settle what we saw
      },
    });

    upstream.body.pipeTo(transform.writable).catch(() => {
      /* client disconnected or upstream dropped — flush() already settles */
    });

    return new Response(transform.readable, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
        // Vercel's proxy buffers compressible responses; opting out of
        // compression is what makes SSE actually flush chunk-by-chunk.
        "Content-Encoding": "none",
      },
    });
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
    if (costNpr > 0) {
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
    }
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
