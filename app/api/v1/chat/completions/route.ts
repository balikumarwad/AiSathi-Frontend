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

import { NextResponse, after } from "next/server";
import { bearerFrom, hashApiKey } from "@/lib/keys";
import { streamStoreEnabled, streamWrite, validStreamId } from "@/lib/streamStore";
import { allowAsync } from "@/lib/ratelimit";
import { usdToNpr, round4 } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upstreamChat, upstreamModels } from "@/lib/upstream";

export const runtime = "nodejs";
// Vercel Pro: allow long streams (big Claude answers, Gaida agent loops)
// instead of the 60s Hobby ceiling that could cut replies mid-sentence.
export const maxDuration = 300;

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

  // Free-tier reliability: when a signed-in free user's free models are all
  // rate-limited upstream, they can fall back to ONE cheap model (gpt-4o-mini),
  // platform-funded, up to a daily cap — so free chat never dead-ends on a 402.
  // The client puts this model last in the free fallback chain.
  const FREE_BACKSTOP_MODEL = "openai/gpt-4o-mini";
  const FREE_BACKSTOP_DAILY = 30;
  let freeBackstop = false;

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
    // Free models stay free for every signed-in user, but with a generous daily
    // cap (~3x a heavy chatter) so the free tier can't be scripted into a bulk
    // pipeline. Heavy users are nudged to a package.
    if (isFree && !(await allowAsync(`freeDay:${auth.keyId}`, 150, 24 * 3_600_000))) {
      return NextResponse.json(
        {
          error: {
            message:
              "You've hit today's free-model limit (150 messages). It resets tomorrow — or get a package for premium models and no daily cap.",
            code: 429,
          },
        },
        { status: 429 },
      );
    }
    if (!isFree) {
      // Rough prompt-token estimate (~4 chars/token) — good enough to gate on.
      const estPromptTok = Math.ceil(JSON.stringify(body.messages).length / 4);
      const worstUsd =
        estPromptTok * price.promptUsd + Number(body.max_tokens) * price.completionUsd;
      const worstNpr = usdToNpr(worstUsd);
      // Unknown/zero-priced-but-not-free models still need *some* credit.
      const required = Math.max(worstNpr, 0.0001);
      if (Number(bal) < required) {
        // Free-tier smoothness: the cheap backstop model is served free (not
        // charged to the user) up to a daily cap, so a free user whose free
        // models are all rate-limited still gets an answer instead of a 402.
        if (
          String(body.model) === FREE_BACKSTOP_MODEL &&
          (await allowAsync(`freebk:${auth.userId}`, FREE_BACKSTOP_DAILY, 24 * 3_600_000))
        ) {
          freeBackstop = true;
          body.max_tokens = Math.min(Number(body.max_tokens) || 1024, 1024);
        } else {
          return NextResponse.json(
            {
              error: {
                message:
                  "Not enough credits for this request. Get a package or top up — or switch to a free model.",
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
  // Resumable: when the client sends an unguessable `x-stream-id` (and Upstash
  // is configured), the accumulated text is mirrored to Redis while streaming
  // and generation KEEPS RUNNING if the connection drops, so the client can
  // re-attach at GET /api/v1/chat/stream/<id> instead of losing the answer.
  if (wantStream && upstream.ok && upstream.body) {
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const streamIdHeader = req.headers.get("x-stream-id");
    const streamId =
      streamStoreEnabled() && validStreamId(streamIdHeader) ? streamIdHeader : null;
    const owner = hashApiKey(bearerFrom(req) ?? "");
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
      // Free-backstop requests are on the house — the user is never charged,
      // even though the real upstream cost is still logged for monitoring.
      const userCostNpr = freeBackstop ? 0 : costNpr;
      let balanceNpr: number | null = null;
      if (auth.mode === "db" && db && usage) {
        let dedErr = null;
        if (userCostNpr > 0) {
          // The answer has already been streamed — it can't be refused now. So
          // settle unconditionally: append the debit even if it drives the
          // balance negative. An overspend is then recorded (not swallowed), and
          // the user's NEXT request is blocked by the worst-case gate above,
          // instead of the stream being effectively served for free.
          const { error } = await db.from("credit_transactions").insert({
            user_id: auth.userId,
            amount_npr: -userCostNpr,
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
          upstream_cost_usd: upstreamUsd, // real platform cost (for monitoring)
          cost_npr: userCostNpr, // 0 when free-backstop — user isn't charged
          // A successful answer is "ok" even on the free backstop (which is
          // identifiable by cost_npr=0 while upstream_cost_usd>0).
          status: dedErr ? "deduct_failed" : "ok",
        });
        await db.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", auth.keyId);
      }
      return { cost_npr: userCostNpr, balance_npr: balanceNpr, cached_tokens: cachedTok, dev_mode: auth.mode === "dev" };
    };

    // The pump below is driven by the UPSTREAM reader, not by client reads, so
    // a vanished client doesn't stall or cancel generation when resumable.
    let fullText = "";
    let clientGone = false;
    let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
    let finalInfo: Record<string, unknown> | null = null;
    let lastMirror = 0;
    const reader = upstream.body.getReader();

    const safeEnqueue = (s: string) => {
      if (clientGone || !controllerRef) return;
      try {
        controllerRef.enqueue(encoder.encode(s));
      } catch {
        clientGone = true;
      }
    };

    const processLine = async (line: string) => {
      if (line.startsWith("data: ")) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") {
          // Bill BEFORE releasing [DONE]; tell the client what it cost.
          const info = await bill();
          if (info) {
            finalInfo = info;
            safeEnqueue(`data: ${JSON.stringify({ nepalai: info })}\n\n`);
          }
          safeEnqueue("data: [DONE]\n\n");
          return;
        }
        try {
          const j = JSON.parse(data);
          if (j.usage) usage = j.usage; // final chunk carries usage + cost
          const delta = j.choices?.[0]?.delta?.content;
          if (typeof delta === "string") fullText += delta;
        } catch {
          /* partial/non-JSON line — pass through */
        }
      }
      safeEnqueue(line + "\n");
    };

    const pump = async () => {
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) await processLine(line);
          if (streamId && !billed && Date.now() - lastMirror > 400) {
            lastMirror = Date.now();
            const { aborted } = await streamWrite(streamId, { owner, text: fullText, done: false });
            if (aborted) {
              // User pressed stop after disconnecting — stop paying upstream.
              try { await reader.cancel(); } catch { /* already closed */ }
              break;
            }
          }
          if (!streamId && clientGone) {
            // Not resumable and nobody is listening: don't pay for the rest.
            try { await reader.cancel(); } catch { /* already closed */ }
            break;
          }
        }
        if (buffer) safeEnqueue(buffer);
        // Abrupt end without [DONE]: still settle what we saw.
        const info = await bill();
        if (info) finalInfo = info;
        if (streamId) await streamWrite(streamId, { owner, text: fullText, done: true, nepalai: finalInfo });
      } catch (e) {
        const info = await bill();
        if (info) finalInfo = info;
        if (streamId) {
          await streamWrite(streamId, { owner, text: fullText, done: true, nepalai: finalInfo, error: String(e) });
        }
      } finally {
        if (controllerRef && !clientGone) {
          try { controllerRef.close(); } catch { /* already closed */ }
        }
      }
    };

    const clientStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controllerRef = controller;
      },
      cancel() {
        clientGone = true;
        if (!streamId) reader.cancel().catch(() => {});
      },
    });

    // Keep the serverless function alive until generation + billing finish,
    // even after the client disconnects (Vercel would otherwise kill us).
    after(pump());

    return new Response(clientStream, {
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

  // Free-backstop answers are on the house (see the balance gate above).
  const userCostNpr = freeBackstop ? 0 : costNpr;
  let balanceNpr: number | null = null;
  if (auth.mode === "db" && db) {
    if (userCostNpr > 0) {
      const { data: newBal, error: dedErr } = await db.rpc("deduct_credits", {
        p_user: auth.userId,
        p_amount_npr: userCostNpr,
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
      cost_npr: userCostNpr,
      status: "ok",
    });
    await db
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", auth.keyId);
  }

  return NextResponse.json({
    ...payload,
    nepalai: { cost_npr: userCostNpr, balance_npr: balanceNpr, cached_tokens: cachedTok, dev_mode: auth.mode === "dev" },
  });
}
