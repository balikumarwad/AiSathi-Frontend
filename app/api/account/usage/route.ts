/**
 * Account-wide usage for the dashboard — authenticated by the user's login
 * session (Supabase JWT), NOT an API key, so the dashboard renders
 * automatically after sign-in. Aggregates across all of the user's keys.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bearerFrom } from "@/lib/keys";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = bearerFrom(req);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const db = supabaseAdmin();
  if (!token || !url || !anon || !db) {
    return NextResponse.json(
      { error: { message: "Sign in required", code: 401 } },
      { status: 401 },
    );
  }
  const authClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: userData } = await authClient.auth.getUser(token);
  if (!userData.user) {
    return NextResponse.json(
      { error: { message: "Sign in required", code: 401 } },
      { status: 401 },
    );
  }
  const uid = userData.user.id;

  const [{ data: bal }, { data: usage }, { data: keys }, { data: spent }] = await Promise.all([
    db.rpc("credit_balance", { p_user: uid }),
    db
      .from("usage_log")
      .select("model, prompt_tokens, completion_tokens, cost_npr, status, created_at, api_key_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30),
    db
      .from("api_keys")
      .select("id, name, key_prefix, active")
      .eq("user_id", uid),
    db.from("usage_log").select("cost_npr.sum()").eq("user_id", uid).eq("status", "ok"),
  ]);

  const keyName = new Map((keys ?? []).map((k) => [k.id, `${k.name} (${k.key_prefix}…)`]));
  return NextResponse.json({
    balance_npr: bal === null ? 0 : Number(bal),
    total_spent_npr: Number((spent?.[0] as { sum?: number } | undefined)?.sum ?? 0),
    active_keys: (keys ?? []).filter((k) => k.active).length,
    recent_usage: (usage ?? []).map((u) => ({
      ...u,
      key: keyName.get(u.api_key_id) ?? "—",
    })),
  });
}
