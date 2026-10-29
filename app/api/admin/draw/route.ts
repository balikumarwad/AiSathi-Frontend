/**
 * Admin: pick this month's रू1,000 lucky-draw winner. POST (admin JWT only).
 * Weighted random: every non-anonymous vote this month = one entry. Returns
 * the winner's email and entry count; paying the winner is manual (eSewa).
 */

import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  const db = supabaseAdmin();
  if (!admin || !db) {
    return NextResponse.json({ error: "Admin access only" }, { status: 403 });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { data: rows, error } = await db
    .from("feedback")
    .select("user_id")
    .eq("anonymous", false)
    .gte("created_at", monthStart.toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const entries = (rows ?? []).map((r) => r.user_id).filter(Boolean) as string[];
  if (entries.length === 0) {
    return NextResponse.json({ error: "No eligible entries this month yet." }, { status: 400 });
  }

  const winnerId = entries[Math.floor(Math.random() * entries.length)];
  const { data: u } = await db.auth.admin.getUserById(winnerId);
  const winnerEntries = entries.filter((e) => e === winnerId).length;

  return NextResponse.json({
    winner: {
      user_id: winnerId,
      email: u.user?.email ?? "(unknown)",
      name: (u.user?.user_metadata?.full_name as string | undefined) ?? null,
      entries: winnerEntries,
    },
    total_entries: entries.length,
    drawn_at: new Date().toISOString(),
  });
}
