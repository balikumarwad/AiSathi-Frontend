/**
 * Public model catalog — upstream models re-priced in NPR.
 * Prices shown per million tokens, already including FX + margin.
 */

import { NextResponse } from "next/server";
import { displayNprPerMillion } from "@/lib/pricing";
import { upstreamModels } from "@/lib/upstream";

export const runtime = "nodejs";

// Models that aren't conversational assistants — safety/moderation classifiers
// (e.g. nemotron-content-safety, llama-guard) that only emit "safe/unsafe"
// labels, plus embedding / rerank / speech models. Hidden from the catalog so
// they can never be picked as a chat model or land in a fallback chain.
const NON_CHAT = /content-safety|safeguard|llama-guard|llamaguard|prompt-guard|shield|guardrail|moderation|\bembed|embedding|rerank|reranker|whisper|text-to-speech|\btts\b|\bstt\b|transcribe|classifier/i;

export async function GET() {
  try {
    const models = (await upstreamModels()) as Array<{
      id: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
      architecture?: { input_modalities?: string[]; output_modalities?: string[] };
    }>;
    const data = models
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
    return NextResponse.json({ data, currency: "NPR", unit: "per_million_tokens" });
  } catch (e) {
    return NextResponse.json(
      { error: { message: `Could not load models: ${String(e)}`, code: 502 } },
      { status: 502 },
    );
  }
}
