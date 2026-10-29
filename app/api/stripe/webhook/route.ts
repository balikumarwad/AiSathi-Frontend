/**
 * Stripe webhook (spec §3.2).
 *
 * Required behavior, all enforced here:
 *   - verify the signature on the RAW body before parsing; 400 on failure
 *   - idempotent: an already-settled payment returns 200 and does nothing
 *     (the pending->completed conditional UPDATE is the guard, same pattern
 *     as the Khalti verify route)
 *   - charge.refunded -> status 'refunded' + negative ledger row
 *   - answer fast; no slow work in the handler
 */

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripeClient, stripeConfigured, webhookSecret } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!stripeConfigured() || !webhookSecret()) {
    return NextResponse.json({ error: "stripe not configured" }, { status: 503 });
  }
  const db = supabaseAdmin();
  if (!db) return NextResponse.json({ error: "db not configured" }, { status: 503 });

  const sig = req.headers.get("stripe-signature") ?? "";
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripeClient()!.webhooks.constructEventAsync(rawBody, sig, webhookSecret());
  } catch {
    // Invalid signature — reject and let Stripe's dashboard log it.
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const paymentId = session.metadata?.payment_id;
    const userId = session.metadata?.user_id;
    if (!paymentId || !userId) return NextResponse.json({ received: true });

    // Idempotent flip: only one delivery wins pending -> completed.
    const { data: flipped } = await db
      .from("payments")
      .update({
        status: "completed",
        verified_at: new Date().toISOString(),
        gateway_txn_id: String(session.payment_intent ?? session.id),
        raw_response: { type: event.type, session_id: session.id },
      })
      .eq("id", paymentId)
      .eq("user_id", userId) // metadata must match the recorded owner
      .eq("status", "pending")
      .select("credit_npr");
    if (flipped && flipped.length > 0) {
      await db.from("credit_transactions").insert({
        user_id: userId,
        amount_npr: Number(flipped[0].credit_npr),
        kind: "topup",
        meta: { provider: "stripe", payment_id: paymentId, session_id: session.id },
      });
    }
  }

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const pi = String(charge.payment_intent ?? "");
    if (pi) {
      // Refund exactly once: only the completed->refunded flip inserts the
      // negative ledger row.
      const { data: refunded } = await db
        .from("payments")
        .update({ status: "refunded", raw_response: { type: event.type, charge_id: charge.id } })
        .eq("gateway", "stripe")
        .eq("gateway_txn_id", pi)
        .eq("status", "completed")
        .select("user_id, credit_npr");
      if (refunded && refunded.length > 0) {
        await db.from("credit_transactions").insert({
          user_id: refunded[0].user_id,
          amount_npr: -Number(refunded[0].credit_npr),
          kind: "adjust",
          meta: { provider: "stripe", reason: "refund", charge_id: charge.id },
        });
      }
    }
  }

  return NextResponse.json({ received: true });
}
