/**
 * Pricing: we pay upstream in USD, users pay in NPR.
 *
 *   cost_npr = upstream_usd * FX * MARGIN
 *
 * MARGIN must cover FX drift + eSewa/Khalti fees + our cut.
 * Both knobs are env vars so pricing can change without a deploy.
 */

export const FX_NPR_PER_USD = Number(process.env.NEPALAI_FX_NPR_PER_USD ?? 140);
export const MARGIN = Number(process.env.NEPALAI_MARGIN ?? 1.25);

export function usdToNpr(usd: number): number {
  return round4(usd * FX_NPR_PER_USD * MARGIN);
}

/** Per-million-token USD prices -> NPR display prices for the catalog. */
export function displayNprPerMillion(usdPerToken: string | number): number {
  const perTok = Number(usdPerToken) || 0;
  return round4(perTok * 1_000_000 * FX_NPR_PER_USD * MARGIN);
}

export function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
