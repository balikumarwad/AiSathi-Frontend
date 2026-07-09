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
import { allowAsync } from "@/lib/ratelimit";
import { usdToNpr, round4 } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upstreamChat, upstreamModels } from "@/lib/upstream";

export const runtime = "nodejs";

type KeyContext =
  | { mode: "dev" }
  | { mode: "demo"; ip: string }
  | { mode: "db"; userId: string; keyId: string };

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "anon";
}

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

  // Anonymous try-before-signup: Bearer "demo" unlocks free models only, with
  // an IP rate limit and no billing. Lets visitors feel the product instantly.
  if (token === "demo") return { mode: "demo", ip: clientIp(req) };

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

/**
 * Look up a model's upstream per-token USD prices from the catalog.
 * `known` is false when the catalog is unreachable or the model isn't listed —
 * callers treat that as "priced, but unknown" (a minimal positive balance is
 * still required) rather than free.
 */
async function modelPricing(model: string): Promise<{
  known: boolean;
  promptUsd: number;
  completionUsd: number;
}> {
  try {
    const models = (await upstreamModels()) as Array<{
      id: string;
      pricing?: { prompt?: string; completion?: string };
    }>;
    const m = models.find((x) => x.id === model);
    if (!m?.pricing) return { known: false, promptUsd: 0, completionUsd: 0 };
    return {
      known: true,
      promptUsd: Number(m.pricing.prompt) || 0,
      completionUsd: Number(m.pricing.completion) || 0,
    };
  } catch {
    return { known: false, promptUsd: 0, completionUsd: 0 };
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

  // Abuse cap: 60 requests/min per key (dev mode keyed as one bucket; demo
  // keyed per IP).
  const rlId = auth.mode === "db" ? auth.keyId : auth.mode === "demo" ? `demo:${auth.ip}` : "dev";
  if (!(await allowAsync(rlId, 60, 60_000))) {
    return NextResponse.json(
      { error: { message: "Rate limit exceeded — max 60 requests/minute per key.", code: 429 } },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  // Demo mode also gets an hourly per-IP cap so the anonymous free lane can't
  // be scripted; honest visitors are additionally capped client-side.
  if (auth.mode === "demo" && !(await allowAsync(`demoHr:${auth.ip}`, 25, 3_600_000))) {
    return NextResponse.json(
      {
        error: {
          message: "You've reached the free demo limit for now. Sign up free to keep chatting — it takes 20 seconds.",
          code: 429,
        },
      },
      { status: 429, headers: { "Retry-After": "3600" } },
    );
  }

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

  // Bound the cost of any single request: clamp completion length to a ceiling
  // so the worst case is predictable. A streamed answer can't be un-sent once it
  // starts, so this cap plus the worst-case gate below is what protects us.
  const MAX_COMPLETION_TOKENS = 8192;
  {
    const reqMax = Number(body.max_tokens);
    body.max_tokens =
      Number.isFinite(reqMax) && reqMax > 0
        ? Math.min(reqMax, MAX_COMPLETION_TOKENS)
        : MAX_COMPLETION_TOKENS;
  }

  // Demo lane: free models only (zero upstream cost), plus one cheap,
  // platform-funded safety-net model. The client tries free models first and
  // only falls back to the safety model when the whole free pool is rate-
  // limited upstream — so an anonymous visitor always gets a reply instead of a
  // "provider error". The 1024-token cap plus the 25/hr per-IP limit keep the
  // worst-case cost of that fallback tiny. Other paid models still nudge to signup.
  const DEMO_SAFETY_MODEL = "openai/gpt-4o-mini";
  if (auth.mode === "demo") {
    const price = await modelPricing(String(body.model));
    const isFree = price.known && price.promptUsd === 0 && price.completionUsd === 0;
    if (!isFree && String(body.model) !== DEMO_SAFETY_MODEL) {
      return NextResponse.json(
        {
          error: {
            message: "This model needs credits. Sign up free to use 26+ free models — or top up for GPT, Claude & Gemini.",
            code: 402,
          },
        },
        { status: 402 },
      );
    }
    body.max_tokens = Math.min(Number(body.max_tokens) || 1024, 1024);
  }

  const db = supabaseAdmin();

  // Balance gate (db mode only): require enough to cover the WORST-CASE cost of
  // this request (whole prompt + capped completion), not merely a positive
  // balance. A `<= 0` gate let a sliver of credit unlock an arbitrarily large
  // stream we can't refuse mid-flight.
  if (auth.mode === "db" && db) {
    const { data: bal, error } = await db.rpc("credit_balance", { p_user: auth.userId });
    if (error) {
      return NextResponse.json(
        { error: { message: "Balance check failed", code: 500 } },
        { status: 500 },
      );
    }
    const price = await modelPricing(String(body.model));
    const isFree = price.known && price.promptUsd === 0 && price.completionUsd === 0;
    if (!isFree) {
      // Rough prompt-token estimate (~4 chars/token) — good enough to gate on.
      const estPromptTok = Math.ceil(JSON.stringify(body.messages).length / 4);
      const worstUsd =
        estPromptTok * price.promptUsd + Number(body.max_tokens) * price.completionUsd;
      const worstNpr = usdToNpr(worstUsd);
      // Unknown/zero-priced-but-not-free models still need *some* credit.
      const required = Math.max(worstNpr, 0.0001);
      if (Number(bal) < required) {
        return NextResponse.json(
          {
            error: {
              message:
                "Insufficient credits for this request. Top up your AIsathi balance — or use a free model (रू0/M in the catalog).",
              code: 402,
            },
            balance_npr: Number(bal),
            estimated_cost_npr: worstNpr,
          },
          { status: 402 },
        );
      }
    }
  }

  const wantStream = body.stream === true;
  // `usage:{include:true}` asks OpenRouter for the cost field; for STREAMS the
  // OpenAI-standard `stream_options.include_usage` is what actually makes the
  // final usage chunk (tokens + cached_tokens) show up — without it a streamed
  // response can arrive with no usage, and we'd bill nothing.
  const upstreamBody = {
    ...body,
    stream: wantStream,
    usage: { include: true },
    ...(wantStream ? { stream_options: { include_usage: true } } : {}),
  };

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
      const cachedTok =
        Number(((usage?.prompt_tokens_details ?? {}) as { cached_tokens?: number }).cached_tokens) || 0;
      const upstreamUsd =
        Number(usage?.cost) ||
        (usage ? await estimateUsd(String(body.model), promptTok, completionTok) : 0);
      const costNpr = usdToNpr(upstreamUsd);
      let balanceNpr: number | null = null;
      if (auth.mode === "db" && db && usage) {
        let dedErr = null;
        if (costNpr > 0) {
          // The answer has already been streamed — it can't be refused now. So
          // settle unconditionally: append the debit even if it drives the
          // balance negative. An overspend is then recorded (not swallowed), and
          // the user's NEXT request is blocked by the worst-case gate above,
          // instead of the stream being effectively served for free.
          const { error } = await db.from("credit_transactions").insert({
            user_id: auth.userId,
            amount_npr: -costNpr,
            kind: "usage",
            meta: { model: body.model, prompt_tokens: promptTok, completion_tokens: completionTok, cached_tokens: cachedTok, stream: true },
          });
          dedErr = error;
          if (!dedErr) {
            const { data: b } = await db.rpc("credit_balance", { p_user: auth.userId });
            balanceNpr = round4(Number(b));
          }
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
      return { cost_npr: costNpr, balance_npr: balanceNpr, cached_tokens: cachedTok, dev_mode: auth.mode === "dev" };
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
  const cachedTok = Number(usage.prompt_tokens_details?.cached_tokens) || 0;
  const upstreamUsd =
    Number(usage.cost) || (await estimateUsd(String(body.model), promptTok, completionTok));
  const costNpr = usdToNpr(upstreamUsd);

  let balanceNpr: number | null = null;
  if (auth.mode === "db" && db) {
    if (costNpr > 0) {
      const { data: newBal, error: dedErr } = await db.rpc("deduct_credits", {
        p_user: auth.userId,
        p_amount_npr: costNpr,
        p_meta: { model: body.model, prompt_tokens: promptTok, completion_tokens: completionTok, cached_tokens: cachedTok },
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
    nepalai: { cost_npr: costNpr, balance_npr: balanceNpr, cached_tokens: cachedTok, dev_mode: auth.mode === "dev" },
  });
}
