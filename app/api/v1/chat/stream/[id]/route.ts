/**
 * Resumable-stream re-attach point.
 *
 * GET  — return the buffered state of a live/finished stream (text so far,
 *        done flag, billing info). The caller must present the same bearer
 *        token that started the stream; ids are unguessable client UUIDs.
 * POST — request abort: the generating function stops paying upstream on its
 *        next mirror tick. Used when the user presses Stop after a disconnect.
 */

import { NextResponse } from "next/server";
import { bearerFrom, hashApiKey } from "@/lib/keys";
import { allowAsync } from "@/lib/ratelimit";
import { streamAbort, streamRead, streamStoreEnabled, validStreamId } from "@/lib/streamStore";

export const runtime = "nodejs";

async function loadState(req: Request, id: string) {
  const token = bearerFrom(req);
  if (!token) {
    return NextResponse.json(
      { error: { message: "Missing Authorization: Bearer <api key>", code: 401 } },
      { status: 401 },
    );
  }
  if (!streamStoreEnabled() || !validStreamId(id)) {
    return NextResponse.json({ error: { message: "Unknown stream", code: 404 } }, { status: 404 });
  }
  const owner = hashApiKey(token);
  // Reconnect polling is ~1 req/s per stream; this cap only stops scripts.
  if (!(await allowAsync(`resume:${owner}`, 240, 60_000))) {
    return NextResponse.json(
      { error: { message: "Rate limit exceeded", code: 429 } },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  const state = await streamRead(id);
  if (!state || state.owner !== owner) {
    return NextResponse.json({ error: { message: "Unknown stream", code: 404 } }, { status: 404 });
  }
  return state;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const state = await loadState(req, id);
  if (state instanceof NextResponse) return state;
  return NextResponse.json({
    text: state.text,
    done: state.done,
    nepalai: state.nepalai ?? null,
    error: state.error ?? null,
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const state = await loadState(req, id);
  if (state instanceof NextResponse) return state;
  await streamAbort(id);
  return NextResponse.json({ ok: true });
}
