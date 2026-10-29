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

/**
 * Pick a thumbnail URL that actually loads in a browser.
 *
 * Openverse's own `/thumb/` proxy currently answers 424 ("Thumbnail
 * unavailable from provider") for most results, which rendered the photo
 * strip as a row of broken-image boxes. So we prefer the provider's direct
 * URL, and for Wikimedia we rewrite it to the official Special:FilePath
 * resizer — a 400px JPEG (~30 KB) instead of the multi-megabyte original.
 */
function bestThumb(url?: string, openverseThumb?: string): string {
  if (url) {
    try {
      const u = new URL(url);
      if (u.hostname === "upload.wikimedia.org") {
        const parts = u.pathname.split("/").filter(Boolean);
        // /wikipedia/commons/8/8b/File.jpg  → File.jpg
        // /wikipedia/commons/thumb/8/8b/File.jpg/400px-File.jpg → File.jpg
        const file = parts.includes("thumb") ? parts[parts.length - 2] : parts[parts.length - 1];
        if (file) {
          return `https://commons.wikimedia.org/wiki/Special:FilePath/${file}?width=400`;
        }
      }
      if (u.protocol === "https:") return url;
    } catch {
      /* malformed URL — fall through */
    }
  }
  return openverseThumb ?? "";
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
      .map((x) => ({
        thumb: bestThumb(x.url, x.thumbnail),
        link: x.foreign_landing_url || x.url || "",
        title: (x.title ?? "").slice(0, 120),
      }))
      .filter((x) => x.thumb)
      .slice(0, 4);
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: [] });
  }
}
