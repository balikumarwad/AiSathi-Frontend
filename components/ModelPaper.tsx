"use client";

/**
 * The reference sheet: every vendor we serve, printed on paper.
 *
 * A deliberate light island on a dark page. The rest of the site is the
 * product; this is the index at the back of it, and it reads as a physical
 * thing — off-white stock, sharp corners, a shadow that lifts it off the wall
 * — because a list of 56 vendors is a reference, not a feature card.
 *
 * Colours are literal hex rather than Tailwind classes. Nearly every colour
 * class on this site is remapped to a dark token in globals.css, so a
 * `text-zinc-900` here would resolve to a dark-theme surface and fight the
 * paper. This element opts out of the theme on purpose, and says so.
 */

import { useEffect, useState } from "react";

import { loadCatalogue, vendorOf } from "@/lib/catalogue";

/* Shown until the catalogue lands, and kept if it never does. Real counts from
   the 2026-09-25 snapshot, so the sheet is never blank and never lies about
   being live — the caption only claims "live" once rows arrive. */
const FALLBACK: [string, number][] = [
  ["OpenAI", 104], ["Google", 45], ["Anthropic", 31], ["Meta", 28],
  ["Qwen", 27], ["Mistral", 24], ["DeepSeek", 18], ["xAI", 12],
  ["NVIDIA", 11], ["Microsoft", 9], ["Cohere", 8], ["Perplexity", 7],
];

type Row = { vendor: string; count: number };

export default function ModelPaper() {
  const [rows, setRows] = useState<Row[]>(
    FALLBACK.map(([vendor, count]) => ({ vendor, count })),
  );
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    loadCatalogue().then((models) => {
      if (!models.length || !alive) return;
      const byVendor = new Map<string, number>();
      for (const m of models) {
        const v = vendorOf(m.id);
        byVendor.set(v, (byVendor.get(v) ?? 0) + 1);
      }
      setRows(
        [...byVendor]
          .map(([vendor, count]) => ({ vendor, count }))
          .sort((a, b) => b.count - a.count || a.vendor.localeCompare(b.vendor)),
      );
      setTotal(models.length);
    });
    return () => { alive = false; };
  }, []);

  return (
    <figure
      className="mx-auto mt-16 max-w-4xl rounded-sm px-7 py-8 sm:px-10 sm:py-10 lg:-rotate-[0.4deg]"
      style={{
        background: "#fbfaf7",
        color: "#18181b",
        boxShadow: "0 30px 60px -25px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-4" style={{ borderColor: "#e4e0d8" }}>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "#9a9488" }}>
          Reference · every model we serve
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "#9a9488" }}>
          {total ? `${total} models · ${rows.length} vendors · live` : `${rows.length} vendors`}
        </span>
      </figcaption>

      {/* A printed index, so it sets in columns and flows down each one rather
          than across — that is what makes it scan as a list you look things up
          in instead of a grid of tiles. */}
      <ul className="mt-6 columns-2 gap-x-10 sm:columns-3 lg:columns-4">
        {rows.map(({ vendor, count }) => (
          <li
            key={vendor}
            className="flex items-baseline justify-between gap-2 break-inside-avoid py-[5px] text-sm"
          >
            <span className="truncate font-medium">{vendor}</span>
            <span className="font-mono text-xs tabular-nums" style={{ color: "#9a9488" }}>{count}</span>
          </li>
        ))}
      </ul>

      <p className="mt-7 border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "#e4e0d8", color: "#6b675f" }}>
        One key reaches all of them, billed together in rupees. Switching vendor
        is one word in your request — no new account, no second card.
      </p>
    </figure>
  );
}
