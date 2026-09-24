/**
 * Public model catalog — upstream models re-priced in NPR.
 * Prices shown per million tokens, already including FX + margin.
 *
 * The list and its filtering live in lib/catalog-server so the /models page
 * can server-render exactly the same catalogue instead of fetching this over
 * HTTP on mount.
 */

import { NextResponse } from "next/server";

import { publicCatalogue } from "@/lib/catalog-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await publicCatalogue();
    return NextResponse.json({ data, currency: "NPR", unit: "per_million_tokens" });
  } catch (e) {
    return NextResponse.json(
      { error: { message: `Could not load models: ${String(e)}`, code: 502 } },
      { status: 502 },
    );
  }
}
