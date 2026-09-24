/**
 * The public catalogue, on the server.
 *
 * Both /api/v1/models and the /models page need exactly this list, filtered
 * exactly this way. It lived only inside the route handler, which meant the
 * page could only reach it over HTTP from the browser — so the 454 models
 * existed only after JavaScript ran, and a crawler saw an empty table.
 *
 * Shared from here so the two cannot drift: a model hidden from the API but
 * visible on the page would be a real bug, not a cosmetic one.
 */

import { displayNprPerMillion } from "@/lib/pricing";
import { upstreamModels } from "@/lib/upstream";

// Models that aren't conversational assistants — safety/moderation classifiers
// (e.g. nemotron-content-safety, llama-guard) that only emit "safe/unsafe"
// labels, plus embedding / rerank / speech models. Hidden from the catalog so
// they can never be picked as a chat model or land in a fallback chain.
const NON_CHAT =
  /content-safety|safeguard|llama-guard|llamaguard|prompt-guard|shield|guardrail|moderation|\bembed|embedding|rerank|reranker|whisper|text-to-speech|\btts\b|\bstt\b|transcribe|classifier/i;

export type PublicModel = {
  id: string;
  name: string;
  context_length: number | null;
  vision: boolean;
  image_out: boolean;
  pricing: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

type Upstream = {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
};

export async function publicCatalogue(): Promise<PublicModel[]> {
  const models = (await upstreamModels()) as Upstream[];
  return models
    .filter((m) => !NON_CHAT.test(m.id) && !NON_CHAT.test(m.name ?? ""))
    .map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      context_length: m.context_length ?? null,
      vision: (m.architecture?.input_modalities ?? []).includes("image"),
      image_out: (m.architecture?.output_modalities ?? []).includes("image"),
      pricing: {
        prompt_npr_per_m: displayNprPerMillion(m.pricing?.prompt ?? 0),
        completion_npr_per_m: displayNprPerMillion(m.pricing?.completion ?? 0),
      },
    }));
}
