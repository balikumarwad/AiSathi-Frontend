/**
 * Admin: platform usage metrics for the /admin monitoring dashboard.
 * GET with Authorization: Bearer <supabase access token>; admin-email gated.
 * All aggregation happens in the admin_metrics() SQL function (one round-trip).
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  const db = supabaseAdmin();
  if (!admin || !db) {
    return NextResponse.json({ error: "Admin access only" }, { status: 403 });
  }
  const url = new URL(req.url);
  const days = Math.min(90, Math.max(1, Number(url.searchParams.get("days")) || 14));
  const { data, error } = await db.rpc("admin_metrics", { days });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}
