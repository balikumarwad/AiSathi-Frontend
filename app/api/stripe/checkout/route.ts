/**
 * International rail: create a Stripe Checkout session for a plan.
 *
 *   POST { plan_id }   (Authorization: Bearer np-…)
 *   -> { checkout_url }
 *
 * Spec rules enforced here:
 *   - the client sends ONLY plan_id; price and credit come from the plans table
 *   - a pending payments row exists before the user leaves for Stripe
 *   - metadata carries payment_id + user_id so the webhook can settle it
 *   - rate limit: max 5 pending payments per user
 */

import { NextResponse } from "next/server";
import { accountFromApiKey } from "@/lib/auth";
import { stripeClient, stripeConfigured } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: { message: "Stripe is not configured (STRIPE_SECRET_KEY missing)", code: 503 } },
      { status: 503 },
    );
  }
  const account = await accountFromApiKey(req);
  if (!account) {
    return NextResponse.json(
      { error: { message: "Invalid or missing API key", code: 401 } },
      { status: 401 },
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
  const planId = String(body.plan_id ?? "").trim();

  // Price/credit come from the plans table ONLY — never from the client.
  const { data: plan } = await db
    .from("plans")
    .select("id, display_name, currency, price, credit_npr, market, active")
    .eq("id", planId)
    .eq("market", "intl")
    .eq("active", true)
    .maybeSingle();
  if (!plan) {
    return NextResponse.json(
      { error: { message: "Unknown or inactive international plan", code: 400 } },
      { status: 400 },
    );
  }

  // Rate limit: max 5 pending payments per user (spec §6).
  const { count } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", account.userId)
    .eq("status", "pending");
  if ((count ?? 0) >= 5) {
    return NextResponse.json(
      { error: { message: "Too many pending payments — finish or wait for reconciliation", code: 429 } },
      { status: 429 },
    );
  }

  // Pending row BEFORE the user leaves for Stripe.
  const { data: payment, error: pErr } = await db
    .from("payments")
    .insert({
      user_id: account.userId,
      provider: "stripe",
      gateway: "stripe",
      pidx: `stripe-${crypto.randomUUID()}`, // legacy khalti column is NOT NULL UNIQUE
      currency: plan.currency,
      amount: plan.price,
      amount_npr: plan.credit_npr,
      credit_npr: plan.credit_npr,
      plan_id: plan.id,
      status: "pending",
    })
    .select("id")
    .single();
  if (pErr || !payment) {
    return NextResponse.json(
      { error: { message: "Could not record payment", code: 500 } },
      { status: 500 },
    );
  }

  const site = process.env.NEPALAI_SITE_URL ?? "http://localhost:3000";
  const stripe = stripeClient()!;
  let session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency.toLowerCase(),
            unit_amount: Math.round(Number(plan.price) * 100),
            product_data: { name: `SathiAI — ${plan.display_name}` },
          },
        },
      ],
      metadata: { payment_id: payment.id, user_id: account.userId },
      success_url: `${site}/topup?stripe=success`,
      cancel_url: `${site}/topup?stripe=cancel`,
    });
  } catch (e) {
    await db.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return NextResponse.json(
      { error: { message: `Stripe error: ${String(e)}`, code: 502 } },
      { status: 502 },
    );
  }

  await db
    .from("payments")
    .update({ gateway_txn_id: session.id })
    .eq("id", payment.id);

  return NextResponse.json({ checkout_url: session.url, payment_id: payment.id });
}
