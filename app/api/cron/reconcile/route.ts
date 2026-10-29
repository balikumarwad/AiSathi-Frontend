/**
 * Reconciliation job (spec §4.3): payments stuck in 'pending' for > 20 min
 * get re-queried at their gateway and settled or failed. Catches dropped
 * callbacks — common on Nepali mobile networks.
 *
 * Trigger: Vercel Cron (daily on Hobby) or manually:
 *   curl -X POST /api/cron/reconcile -H "Authorization: Bearer $CRON_SECRET"
 */

import { NextResponse } from "next/server";
import { khaltiConfigured, khaltiLookup } from "@/lib/khalti";
import { round4 } from "@/lib/pricing";
import { stripeClient, stripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const STUCK_MINUTES = 20;

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 503 });

  const cutoff = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();
  const { data: stuck } = await db
    .from("payments")
    .select("id, user_id, gateway, gateway_txn_id, pidx, credit_npr, amount")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .limit(50);

  const results: Array<{ id: string; outcome: string }> = [];

  for (const p of stuck ?? []) {
    try {
      if (p.gateway === "khalti" && khaltiConfigured()) {
        const lookup = await khaltiLookup(p.pidx);
        if (lookup.status === "Completed") {
          const paidNpr = round4(lookup.total_amount / 100);
          if (Math.abs(paidNpr - Number(p.amount)) > 0.01) {
            await db.from("payments").update({ status: "failed", raw_response: { reconcile: "amount_mismatch", lookup } }).eq("id", p.id).eq("status", "pending");
            results.push({ id: p.id, outcome: "failed:amount_mismatch" });
            continue;
          }
          const { data: flipped } = await db
            .from("payments")
            .update({ status: "completed", verified_at: new Date().toISOString(), raw_response: { reconcile: true } })
            .eq("id", p.id)
            .eq("status", "pending")
            .select("id");
          if (flipped && flipped.length > 0) {
            await db.from("credit_transactions").insert({
              user_id: p.user_id,
              amount_npr: Number(p.credit_npr),
              kind: "topup",
              meta: { provider: "khalti", pidx: p.pidx, reconciled: true },
            });
          }
          results.push({ id: p.id, outcome: "completed" });
        } else if (["Expired", "User canceled", "Refunded"].includes(lookup.status)) {
          await db.from("payments").update({ status: "failed" }).eq("id", p.id).eq("status", "pending");
          results.push({ id: p.id, outcome: `failed:${lookup.status}` });
        } else {
          results.push({ id: p.id, outcome: `still:${lookup.status}` });
        }
      } else if (p.gateway === "stripe" && stripeConfigured() && p.gateway_txn_id?.startsWith("cs_")) {
        const session = await stripeClient()!.checkout.sessions.retrieve(p.gateway_txn_id);
        if (session.payment_status === "paid") {
          const { data: flipped } = await db
            .from("payments")
            .update({ status: "completed", verified_at: new Date().toISOString(), gateway_txn_id: String(session.payment_intent ?? session.id), raw_response: { reconcile: true } })
            .eq("id", p.id)
            .eq("status", "pending")
            .select("id");
          if (flipped && flipped.length > 0) {
            await db.from("credit_transactions").insert({
              user_id: p.user_id,
              amount_npr: Number(p.credit_npr),
              kind: "topup",
              meta: { provider: "stripe", session_id: p.gateway_txn_id, reconciled: true },
            });
          }
          results.push({ id: p.id, outcome: "completed" });
        } else if (session.status === "expired") {
          await db.from("payments").update({ status: "expired" }).eq("id", p.id).eq("status", "pending");
          results.push({ id: p.id, outcome: "expired" });
        } else {
          results.push({ id: p.id, outcome: "still:pending" });
        }
      } else {
        results.push({ id: p.id, outcome: "skipped:gateway_unconfigured" });
      }
    } catch (e) {
      results.push({ id: p.id, outcome: `error:${String(e).slice(0, 120)}` });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}

// Vercel Cron triggers via GET (it sends Authorization: Bearer CRON_SECRET).
export const GET = POST;
