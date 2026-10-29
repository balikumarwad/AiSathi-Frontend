/**
 * Verify a Khalti payment and credit the ledger — exactly once.
 *
 *   POST { pidx }  ->  { status, credited_npr?, balance_npr? }
 *
 * Security model:
 *   - The redirect back from Khalti proves nothing; we call Khalti's
 *     server-side lookup and require status === "Completed".
 *   - The paid amount must match what we recorded at initiate time.
 *   - Idempotency: the pending->completed flip is a conditional UPDATE on
 *     (pidx, status='pending'); only the request that wins the flip credits
 *     the ledger. Re-verifying a completed payment returns its status without
 *     crediting again.
 */

import { NextResponse } from "next/server";
import { khaltiConfigured, khaltiLookup } from "@/lib/khalti";
import { round4 } from "@/lib/pricing";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!khaltiConfigured()) {
    return NextResponse.json(
      { error: { message: "Khalti is not configured (KHALTI_SECRET_KEY missing)", code: 503 } },
      { status: 503 },
    );
  }
  const db = supabaseAdmin();
  if (!db) {
    return NextResponse.json(
      { error: { message: "Database not configured", code: 503 } },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const pidx = String(body.pidx ?? "").trim();
  if (!pidx) {
    return NextResponse.json(
      { error: { message: "`pidx` is required", code: 400 } },
      { status: 400 },
    );
  }

  const { data: payment } = await db
    .from("payments")
    .select("id, user_id, amount_npr, status")
    .eq("pidx", pidx)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json(
      { error: { message: "Unknown payment", code: 404 } },
      { status: 404 },
    );
  }
  if (payment.status === "completed") {
    return NextResponse.json({ status: "completed", note: "Already credited." });
  }

  // Ask Khalti what actually happened.
  let lookup;
  try {
    lookup = await khaltiLookup(pidx);
  } catch (e) {
    return NextResponse.json(
      { error: { message: String(e), code: 502 } },
      { status: 502 },
    );
  }

  if (lookup.status !== "Completed") {
    const terminal = ["Expired", "User canceled", "Refunded"].includes(lookup.status);
    if (terminal) {
      await db.from("payments").update({ status: "failed" }).eq("id", payment.id).eq("status", "pending");
    }
    return NextResponse.json({ status: lookup.status.toLowerCase(), credited: false });
  }

  // Amount must match what we initiated (paisa vs NPR).
  const paidNpr = round4(lookup.total_amount / 100);
  if (Math.abs(paidNpr - Number(payment.amount_npr)) > 0.01) {
    return NextResponse.json(
      { error: { message: `Amount mismatch: paid ${paidNpr}, expected ${payment.amount_npr}`, code: 409 } },
      { status: 409 },
    );
  }

  // Idempotent flip: only one request wins pending -> completed.
  const { data: flipped } = await db
    .from("payments")
    .update({ status: "completed", verified_at: new Date().toISOString(), meta: { txn: lookup.transaction_id ?? null } })
    .eq("id", payment.id)
    .eq("status", "pending")
    .select("id");
  if (!flipped || flipped.length === 0) {
    return NextResponse.json({ status: "completed", note: "Already credited." });
  }

  // Credit the ledger.
  const { error: creditErr } = await db.from("credit_transactions").insert({
    user_id: payment.user_id,
    amount_npr: paidNpr,
    kind: "topup",
    meta: { provider: "khalti", pidx, txn: lookup.transaction_id ?? null },
  });
  if (creditErr) {
    // Payment verified but credit failed — surface loudly; ops must reconcile.
    return NextResponse.json(
      { error: { message: "Payment verified but crediting failed — contact support", code: 500 } },
      { status: 500 },
    );
  }

  const { data: bal } = await db.rpc("credit_balance", { p_user: payment.user_id });
  return NextResponse.json({
    status: "completed",
    credited_npr: paidNpr,
    balance_npr: round4(Number(bal ?? 0)),
  });
}
