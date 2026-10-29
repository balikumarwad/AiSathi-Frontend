/**
 * Key-scoped account info (OpenRouter-style): send your SathiAI API key,
 * get back your balance and recent usage. Powers the dashboard without a
 * full login UI.
 */

import { NextResponse } from "next/server";
import { bearerFrom, hashApiKey } from "@/lib/keys";
import { round4 } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = bearerFrom(req);
  if (!token) {
    return NextResponse.json(
      { error: { message: "Missing Authorization: Bearer <api key>", code: 401 } },
      { status: 401 },
    );
  }
  if (process.env.NEPALAI_DEV_KEY && token === process.env.NEPALAI_DEV_KEY) {
    return NextResponse.json({
      dev_mode: true,
      balance_npr: null,
      recent_usage: [],
      note: "Dev key: no database account attached.",
    });
  }
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: { message: "Gateway database not configured", code: 503 } },
      { status: 503 },
    );
  }
  const { data: keyRow } = await db
    .from("api_keys")
    .select("id, user_id, active, name, key_prefix, created_at")
    .eq("key_hash", hashApiKey(token))
    .maybeSingle();
  if (!keyRow || !keyRow.active) {
    return NextResponse.json(
      { error: { message: "Invalid or revoked API key", code: 401 } },
      { status: 401 },
    );
  }

  const [{ data: bal }, { data: usage }] = await Promise.all([
    db.rpc("credit_balance", { p_user: keyRow.user_id }),
    db
      .from("usage_log")
      .select("model, prompt_tokens, completion_tokens, cost_npr, status, created_at")
      .eq("user_id", keyRow.user_id)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  return NextResponse.json({
    key: { name: keyRow.name, prefix: keyRow.key_prefix, created_at: keyRow.created_at },
    balance_npr: round4(Number(bal ?? 0)),
    recent_usage: usage ?? [],
  });
}
