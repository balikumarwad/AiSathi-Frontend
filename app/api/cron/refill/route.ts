/**
 * Auto-refill cron (LibreChat balance pattern): periodically grant a small
 * platform-funded credit to active users whose balance fell below a threshold,
 * so the free tier keeps breathing between top-ups.
 *
 * DISABLED until REFILL_AMOUNT_NPR is set (> 0) — granting credits is real
 * platform spend, so turning it on is an explicit founder decision, made by
 * adding the env var in Vercel. Tunables:
 *   REFILL_AMOUNT_NPR     credit granted per refill (default 0 = disabled)
 *   REFILL_THRESHOLD_NPR  only users below this balance qualify (default 5)
 *   REFILL_INTERVAL_DAYS  min days between refills per user (default 30)
 *
 * Trigger: Vercel Cron (daily) or manually:
 *   curl -X POST /api/cron/refill -H "Authorization: Bearer $CRON_SECRET"
 * Preview without granting: POST /api/cron/refill?dry=1
 */

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 503 });

  const amount = Number(process.env.REFILL_AMOUNT_NPR) || 0;
  const threshold = Number(process.env.REFILL_THRESHOLD_NPR) || 5;
  const intervalDays = Number(process.env.REFILL_INTERVAL_DAYS) || 30;
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  if (amount <= 0 && !dry) {
    return NextResponse.json({ disabled: true, hint: "set REFILL_AMOUNT_NPR to enable" });
  }

  const { data, error } = await db.rpc("grant_refills", {
    p_amount_npr: amount,
    p_threshold_npr: threshold,
    p_interval_days: intervalDays,
    p_dry: dry,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const users = (data ?? []) as string[];
  return NextResponse.json({
    dry,
    enabled: amount > 0,
    amount_npr: amount,
    threshold_npr: threshold,
    interval_days: intervalDays,
    eligible_users: users.length,
    ...(dry ? {} : { granted_users: amount > 0 ? users.length : 0 }),
  });
}

// Vercel Cron fires GET; keep POST for manual/curl use.
export const GET = POST;
