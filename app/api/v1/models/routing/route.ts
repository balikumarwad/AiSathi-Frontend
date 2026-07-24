/**
 * Smart-router config (LibreChat modelSpecs pattern): task-type -> model
 * chain, stored in the routing_specs table so routing can be tuned live in
 * the Supabase dashboard — no redeploy. Public read; CDN-cached 5 minutes.
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ specs: [] });
  const { data } = await db
    .from("routing_specs")
    .select("task, priority, match_regex, min_balance_npr, premium_models, free_patterns")
    .eq("enabled", true)
    .order("priority", { ascending: false });
  return NextResponse.json(
    { specs: data ?? [] },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}
