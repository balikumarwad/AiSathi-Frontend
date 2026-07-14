/**
 * Free image search for "rich answer" cards (like ChatGPT's photo strip).
 * Backed by Openverse (openverse.org) — Creative-Commons images, no API key,
 * legal to display, thumbnails served from one stable host. Open to demo and
 * signed-in traffic (public info); rate-limited per IP.
 */

import { NextResponse } from "next/server";
import { allowAsync } from "@/lib/ratelimit";

export const runtime = "nodejs";

function clientIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 120);
  if (q.length < 2) return NextResponse.json({ images: [] });

  if (!(await allowAsync(`img:${clientIp(req)}`, 40, 60_000))) {
    return NextResponse.json({ images: [] }, { status: 429 });
  }

  try {
    const r = await fetch(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=4&mature=false`,
      { headers: { "User-Agent": "AIsathi/1.0 (+https://aisathi.io)" } },
    );
    if (!r.ok) return NextResponse.json({ images: [] });
    const j = (await r.json()) as {
      results?: { thumbnail?: string; url?: string; foreign_landing_url?: string; title?: string }[];
    };
    const images = (j.results ?? [])
      .map((x) => ({ thumb: x.thumbnail || x.url || "", link: x.foreign_landing_url || x.url || "", title: (x.title ?? "").slice(0, 120) }))
      .filter((x) => x.thumb)
      .slice(0, 4);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
