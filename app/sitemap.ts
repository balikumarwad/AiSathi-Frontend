import type { MetadataRoute } from "next";

import { SITE } from "@/lib/seo";

/**
 * Only pages worth landing on from a search result.
 *
 * /login was listed: a page with nothing to read, no reason to rank, and — until
 * the layout added beside it — the same <title> as the homepage. Submitting it
 * spends crawl budget on it and invites Google to treat it as a duplicate of
 * the pages that matter.
 *
 * /topup, /dashboard and /account were never here and stay out. They sit behind
 * a login and are already disallowed in robots.ts.
 */
const PAGES: {
  path: string;
  priority: number;
  freq: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
}[] = [
  { path: "", priority: 1, freq: "weekly" },
  { path: "/models", priority: 0.9, freq: "daily" },
  { path: "/docs", priority: 0.8, freq: "weekly" },
  { path: "/playground", priority: 0.6, freq: "weekly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((p) => ({
    url: `${SITE}${p.path}`,
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
