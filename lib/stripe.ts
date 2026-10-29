/**
 * Stripe client (international rail). Configured lazily so the whole app runs
 * fine — with these routes returning 503 — until keys are added.
 */

import Stripe from "stripe";

let cached: Stripe | null | undefined;

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripeClient(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  cached = key ? new Stripe(key) : null;
  return cached;
}

export function webhookSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET ?? "";
}
