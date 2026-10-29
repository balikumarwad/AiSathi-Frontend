/**
 * One catalogue request per page load, however many components ask for it.
 *
 * The hero galaxy and the reference sheet both draw the same list. Two plain
 * fetches would be two round trips for one answer — the response has no cache
 * headers to save us — so the promise is memoised at module scope and shared.
 * Every caller gets the same array; nobody waits twice.
 *
 * It resolves to [] rather than rejecting. Both callers have something honest
 * to show without the catalogue (a placeholder sky, a static provider list),
 * and neither should have to write a catch to get it.
 */

export type CatalogueRow = {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

let inflight: Promise<CatalogueRow[]> | null = null;

export function loadCatalogue(): Promise<CatalogueRow[]> {
  if (!inflight) {
    inflight = fetch("/api/v1/models")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => (Array.isArray(j?.data) ? (j.data as CatalogueRow[]) : []))
      .catch(() => []);
  }
  return inflight;
}

/**
 * Upstream ids are "vendor/model". Two things have to happen before a slug is
 * fit to print:
 *
 *   1. Some ids carry a leading "~". Those were landing in the index as
 *      separate vendors — a "~Openai" sitting four rows below "OpenAI" — which
 *      is wrong on a sheet whose whole claim is that it lists who we serve.
 *      The prefix is stripped and the counts merge.
 *   2. Title-casing a slug gets "Arcee Ai" and "Ibm Granite". The acronym pass
 *      at the end fixes the ones that would read as typos.
 *
 * The explicit map covers casing a reader would notice — xAI, NVIDIA, Z.ai —
 * and nothing else, so it stays short instead of growing to all 50-odd.
 */
const VENDOR: Record<string, string> = {
  openai: "OpenAI", "meta-llama": "Meta", mistralai: "Mistral", "x-ai": "xAI",
  ai21: "AI21", nvidia: "NVIDIA", deepseek: "DeepSeek", moonshotai: "Moonshot",
  "z-ai": "Z.ai", thudm: "THUDM", "01-ai": "01.AI", openrouter: "OpenRouter",
  neversleep: "NeverSleep", nousresearch: "Nous Research",
  cognitivecomputations: "Cognitive Computations", bytedance: "ByteDance",
  "bytedance-seed": "ByteDance Seed", minimax: "MiniMax", stepfun: "StepFun",
  inclusionai: "InclusionAI", thinkingmachines: "Thinking Machines",
  "ibm-granite": "IBM Granite", "aion-labs": "Aion Labs",
};


export function vendorOf(id: string): string {
  const slug = (id.split("/")[0] ?? id).replace(/^~+/, "").toLowerCase();
  const name =
    VENDOR[slug] ??
    slug.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return name
    .replace(/\bAi\b/g, "AI")
    .replace(/\bIbm\b/g, "IBM")
    .replace(/\bMl\b/g, "ML")
    .replace(/\bAgi\b/g, "AGI");
}
