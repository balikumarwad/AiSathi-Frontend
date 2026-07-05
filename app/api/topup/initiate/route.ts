/**
 * Start a Khalti top-up.
 *
 *   POST { amount_npr }   (Authorization: Bearer np-…)
 *   -> { payment_url, pidx }  — redirect the user to payment_url
 *
 * A pending `payments` row is recorded BEFORE the user leaves for Khalti,
 * so verification later knows who to credit and for how much.
 */

import { NextResponse } from "next/server";
import { accountFromApiKey } from "@/lib/auth";
import { khaltiConfigured, khaltiInitiate } from "@/lib/khalti";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const MIN_NPR = 50;
const MAX_NPR = 50_000;

export async function POST(req: Request) {
  if (!khaltiConfigured()) {
    return NextResponse.json(
      { error: { message: "Khalti is not configured (KHALTI_SECRET_KEY missing)", code: 503 } },
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

  // Either a NP plan (price read server-side from the plans table — the
  // client never sends an amount for plans) or a bounded custom PAYG topup.
  const body = await req.json().catch(() => ({}));
  const planId = String(body.plan_id ?? "").trim();
  let amount: number;
  let orderName: string;
  if (planId) {
    const { data: plan } = await db
      .from("plans")
      .select("id, display_name, price, credit_npr, market, active")
      .eq("id", planId)
      .eq("market", "np")
      .eq("active", true)
      .maybeSingle();
    if (!plan) {
      return NextResponse.json(
        { error: { message: "Unknown or inactive Nepal plan", code: 400 } },
        { status: 400 },
      );
    }
    amount = Number(plan.price);
    orderName = `AIsathi — ${plan.display_name}`;
  } else {
    amount = Number(body.amount_npr);
    if (!Number.isFinite(amount) || amount < MIN_NPR || amount > MAX_NPR) {
      return NextResponse.json(
        { error: { message: `amount_npr must be between ${MIN_NPR} and ${MAX_NPR}`, code: 400 } },
        { status: 400 },
      );
    }
    orderName = `AIsathi credits रू${amount}`;
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

  const site = process.env.NEPALAI_SITE_URL ?? "http://localhost:3000";
  const orderId = `topup-${account.userId.slice(0, 8)}-${Date.now()}`;

  let init;
  try {
    init = await khaltiInitiate({
      amountNpr: amount,
      orderId,
      orderName,
      returnUrl: `${site}/topup`,
      websiteUrl: site,
    });
  } catch (e) {
    return NextResponse.json(
      { error: { message: String(e), code: 502 } },
      { status: 502 },
    );
  }

  const { error } = await db.from("payments").insert({
    user_id: account.userId,
    provider: "khalti",
    gateway: "khalti",
    pidx: init.pidx,
    gateway_txn_id: init.pidx,
    currency: "NPR",
    amount,
    amount_npr: amount,
    credit_npr: amount,
    plan_id: planId || null,
    status: "pending",
    meta: { order_id: orderId },
  });
  if (error) {
    return NextResponse.json(
      { error: { message: "Could not record payment", code: 500 } },
      { status: 500 },
    );
  }

  return NextResponse.json({ payment_url: init.payment_url, pidx: init.pidx });
}
