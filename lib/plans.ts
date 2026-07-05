/**
 * Subscription plans — the "रू300 per user" business model.
 *
 * Rule: plan price = expected upstream cost at the tier's usage cap + रू300
 * margin per user. Verified against real OpenRouter prices (2026-07-05,
 * FX 140):
 *
 *   regular user (50 msgs/day ≈ 900k in / 600k out per month):
 *     gpt-4o-mini / llama-4:  ~रू69 upstream
 *     deepseek-v3.2:          ~रू58 upstream
 *     claude-haiku-4.5:       ~रू546 upstream
 *     claude-sonnet-5:        ~रू1,092 upstream  <- can never be in a flat plan
 *
 * Premium models (Sonnet, GPT-5.x, ...) stay pay-as-you-go via the credit
 * ledger with the percentage margin (NEPALAI_MARGIN) — a flat plan cannot
 * absorb रू1000+/user upstream.
 */

export const MARGIN_NPR_PER_USER = 300;

export type Plan = {
  id: string;
  name: string;
  price_npr: number; // per month
  monthly_token_cap: number; // in + out combined
  expected_upstream_npr: number; // at cap, budget models
  models: "budget" | "standard" | "all-payg";
  blurb: string;
};

/** Models allowed on flat plans, by tier. Anything else = pay-as-you-go. */
export const BUDGET_MODELS = [
  "openai/gpt-4o-mini",
  "meta-llama/llama-4-maverick",
  "deepseek/deepseek-v3.2",
];
export const STANDARD_MODELS = [...BUDGET_MODELS, "anthropic/claude-haiku-4.5"];

export const PLANS: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    price_npr: 399,
    monthly_token_cap: 1_600_000, // ~ regular user: 900k in + 600k out + headroom
    expected_upstream_npr: 99,
    models: "budget",
    blurb: "Everyday chat on fast budget models. ~50 messages a day.",
  },
  {
    id: "pro",
    name: "Pro",
    price_npr: 899,
    monthly_token_cap: 2_500_000,
    expected_upstream_npr: 599, // haiku-class regular usage
    models: "standard",
    blurb: "Adds Claude Haiku 4.5 for harder tasks. Priority support.",
  },
  {
    id: "payg",
    name: "Pay as you go",
    price_npr: 0, // top-up based
    monthly_token_cap: Infinity,
    expected_upstream_npr: 0,
    models: "all-payg",
    blurb: "Every model, billed per token in NPR. Top up रू200+ via eSewa/Khalti.",
  },
];

// Every flat tier nets रू300/user/month at cap:
//   Basic: 399 - ~99  ≈ रू300
//   Pro:   899 - ~599 ≈ रू300
// PAYG margin comes from NEPALAI_MARGIN on the per-token price instead.

export function planAllows(planId: string, model: string): boolean {
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan || plan.models === "all-payg") return true;
  const allowed = plan.models === "budget" ? BUDGET_MODELS : STANDARD_MODELS;
  return allowed.includes(model);
}
