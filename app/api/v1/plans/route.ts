/**
 * Public plan catalog. Served from the plans table (dual-market: np + intl);
 * falls back to the static definitions if the database isn't configured.
 */

import { NextResponse } from "next/server";
import { PLANS } from "@/lib/plans";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const db = supabaseAdmin();
  if (db) {
    const { data } = await db
      .from("plans")
      .select("id, market, display_name, currency, price, credit_npr")
      .eq("active", true)
      .order("market")
      .order("price");
    if (data && data.length > 0) {
      return NextResponse.json({ data, source: "db" });
    }
  }
  // Fallback: static catalog (pre-migration or offline dev).
  return NextResponse.json({
    data: PLANS.map(({ id, name, price_npr, models, blurb }) => ({
      id,
      market: "np",
      display_name: name,
      currency: "NPR",
      price: price_npr,
      credit_npr: price_npr,
      models,
      blurb,
    })),
    source: "static",
  });
}
