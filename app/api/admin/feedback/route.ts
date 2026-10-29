/**
 * Admin: feedback overview — stats, recent votes, and this month's lucky-draw
 * standings. GET with Authorization: Bearer <supabase access token>; only
 * admin emails (lib/adminAuth) may read. Powers /admin.
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

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [{ count: total }, { count: ups }, { count: downs }, recent, monthRows] = await Promise.all([
    db.from("feedback").select("id", { count: "exact", head: true }),
    db.from("feedback").select("id", { count: "exact", head: true }).eq("vote", "up"),
    db.from("feedback").select("id", { count: "exact", head: true }).eq("vote", "down"),
    db.from("feedback")
      .select("id, created_at, vote, model, question, answer, anonymous, user_id")
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("feedback")
      .select("user_id")
      .eq("anonymous", false)
      .gte("created_at", monthStart.toISOString()),
  ]);

  // Draw standings: entries per signed-in user this month, with emails.
  const counts = new Map<string, number>();
  for (const r of monthRows.data ?? []) {
    if (r.user_id) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1);
  }
  const standings = await Promise.all(
    [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(async ([userId, entries]) => {
        const { data } = await db.auth.admin.getUserById(userId);
        return { user_id: userId, email: data.user?.email ?? "(unknown)", entries };
      }),
  );

  return NextResponse.json({
    stats: {
      total: total ?? 0,
      up: ups ?? 0,
      down: downs ?? 0,
      month_entries: (monthRows.data ?? []).length,
      month_participants: counts.size,
    },
    standings,
    recent: (recent.data ?? []).map((r) => ({
      ...r,
      question: (r.question ?? "").slice(0, 300),
      answer: (r.answer ?? "").slice(0, 500),
    })),
  });
}
