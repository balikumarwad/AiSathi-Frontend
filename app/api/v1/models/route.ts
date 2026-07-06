/**
 * Public model catalog — upstream models re-priced in NPR.
 * Prices shown per million tokens, already including FX + margin.
 */

import { NextResponse } from "next/server";
import { displayNprPerMillion } from "@/lib/pricing";
import { upstreamModels } from "@/lib/upstream";

export const runtime = "nodejs";

export async function GET() {
  try {
    const models = (await upstreamModels()) as Array<{
      id: string;
      name?: string;
      context_length?: number;
      pricing?: { prompt?: string; completion?: string };
      architecture?: { input_modalities?: string[] };
    }>;
    const data = models.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      context_length: m.context_length ?? null,
      vision: (m.architecture?.input_modalities ?? []).includes("image"),
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
