"use client";

/**
 * The vendor board: the AI we serve, pegged to strings like a pinboard.
 *
 * A deliberate light island on a dark page — the rest of the site is the
 * product, this is the wall it gets planned on.
 *
 * Only vendors we hold a logo for hang here, joined by name against
 * lib/vendor-logos.ts. The board is a picture, not an index: it hangs the
 * marks a reader recognises and admits the rest on a blank tag. The complete
 * list is at /models.
 *
 * Colours are literal hex rather than Tailwind classes. Nearly every colour
 * class on this site is remapped to a dark token in globals.css, so a
 * `text-zinc-900` here would resolve to a dark-theme surface and fight the
 * paper. This element opts out of the theme on purpose, and says so.
 */

import { useEffect, useState } from "react";

import { loadCatalogue, vendorOf } from "@/lib/catalogue";
import { VENDOR_LOGOS } from "@/lib/vendor-logos";

/* Shown until the catalogue lands, and kept if it never does. Real counts from
   the 2026-09-25 snapshot, so the board is never blank — and the caption only
   claims "live" once rows actually arrive. */
const FALLBACK: [string, number][] = [
  ["OpenAI", 104], ["Qwen", 54], ["Google", 43], ["Anthropic", 32],
  ["Mistral", 23], ["Z.ai", 21], ["DeepSeek", 19], ["Meta", 13],
  ["Moonshot", 9], ["xAI", 9], ["MiniMax", 8], ["NVIDIA", 8],
  ["Tencent", 7], ["Aion Labs", 6], ["Cohere", 6], ["OpenRouter", 6],
  ["ByteDance Seed", 6], ["Amazon", 5],
];

type Tag = { vendor: string; count: number | null; logo: string | null };

/* Deterministic jitter. Math.random() would re-roll on every render — React
   renders twice in development — and the tags would twitch. Hashing the name
   means a vendor always hangs in the same place. */
function noise(seed: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  }
  return ((h >>> 8) % 1000) / 1000;
}

export default function ModelPaper() {
  const [rows, setRows] = useState<[string, number][]>(FALLBACK);
  const [total, setTotal] = useState(0);
  const [vendors, setVendors] = useState(0);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    loadCatalogue().then((models) => {
      if (!models.length || !alive) return;
      const byVendor = new Map<string, number>();
      for (const m of models) {
        const v = vendorOf(m.id);
        byVendor.set(v, (byVendor.get(v) ?? 0) + 1);
      }
      const all = [...byVendor].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      setVendors(all.length);
      // Only the ones we can actually show a mark for. A vendor whose logo we
      // do not hold is still counted in the total and in "+N more" — it just
      // does not hang.
      setRows(all.filter(([v]) => VENDOR_LOGOS[v]));
      setTotal(models.length);
    });
    return () => { alive = false; };
  }, []);

  const shown = narrow ? 11 : 18;
  const tags: Tag[] = rows.slice(0, shown).map(([vendor, count]) => ({
    vendor, count, logo: VENDOR_LOGOS[vendor] ?? null,
  }));
  const hidden = Math.max((vendors || rows.length) - tags.length, 0);
  if (hidden > 0) tags.push({ vendor: `+${hidden} more`, count: null, logo: null });

  const W = narrow ? 420 : 1040;
  const LINES = 4;
  const PAD = narrow ? 12 : 26;
  const TOP = narrow ? 26 : 34;
  const GAP = narrow ? 98 : 114;
  const CW = narrow ? 88 : 112;   // card
  const CH = narrow ? 46 : 58;
  const FS = narrow ? 8.5 : 9.5;  // the count, under the card

  // Contiguous slices, so the heaviest vendors hang on the top string and the
  // tail settles to the bottom — the board still reads top-down.
  const per = Math.ceil(tags.length / LINES);
  // The height follows the strings actually used, not the strings asked for.
  // Ceil-dividing 12 tags over 5 lines fills four and leaves the fifth empty,
  // which on a phone was a blank third of the sheet.
  const used = Math.ceil(tags.length / per);
  const H = TOP + (used - 1) * GAP + CH + (narrow ? 42 : 50);

  return (
    <figure
      className="mx-auto mt-16 max-w-4xl rounded-sm px-5 py-7 sm:px-9 sm:py-9 lg:-rotate-[0.4deg]"
      style={{
        background: "#fbfaf7",
        color: "#18181b",
        boxShadow: "0 30px 60px -25px rgba(0,0,0,0.75), 0 2px 6px rgba(0,0,0,0.35)",
      }}
    >
      <figcaption
        className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b pb-4"
        style={{ borderColor: "#e4e0d8" }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "#9a9488" }}>
          Every AI we serve
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em]" style={{ color: "#9a9488" }}>
          {total ? `${total} models · ${vendors} vendors · live` : `${rows.length} vendors`}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="mt-1 block h-auto"
        role="img"
        aria-label={`AI vendors AIsathi serves: ${tags.filter((t) => t.logo).map((t) => t.vendor).join(", ")}${hidden ? `, and ${hidden} more` : ""}.`}
      >
        {Array.from({ length: used }, (_, line) => {
          const group = tags.slice(line * per, line * per + per);
          if (!group.length) return null;

          const y = TOP + line * GAP;
          const sag = narrow ? 11 : 16;
          // A string fixed at both ends dips in the middle. At this sag a
          // parabola is indistinguishable from a catenary and is one line.
          const dip = (x: number) => y + sag * (1 - ((2 * x) / W - 1) ** 2);
          const step = (W - PAD * 2) / group.length;

          return (
            <g key={line}>
              <path
                d={`M ${PAD} ${dip(PAD)} Q ${W / 2} ${dip(W / 2) + sag} ${W - PAD} ${dip(W - PAD)}`}
                fill="none"
                stroke="#cdc7ba"
                strokeWidth="1"
              />
              {group.map((tag) => {
                const i = group.indexOf(tag);
                const x = PAD + step * (i + 0.5) + (noise(tag.vendor, 1) - 0.5) * step * 0.16;
                const pin = dip(x);
                const yTop = pin + (narrow ? 11 : 14) + noise(tag.vendor, 2) * (narrow ? 8 : 14);
                const tilt = (noise(tag.vendor, 3) - 0.5) * 6;
                const left = x - CW / 2;

                return (
                  <g key={tag.vendor} transform={`rotate(${tilt} ${x} ${pin})`}>
                    <line x1={x} y1={pin} x2={x} y2={yTop} stroke="#cdc7ba" strokeWidth="1" />
                    {/* the peg: a stub across the string, so the card reads as
                        clipped on rather than floating under it */}
                    <rect x={x - 4} y={pin - 3.5} width="8" height="7" rx="2" fill="#b9b2a2" />

                    {tag.logo ? (
                      <>
                        <rect
                          x={left + 1.5} y={yTop + 2.5} width={CW} height={CH} rx="3"
                          fill="rgba(24,24,27,0.10)"
                        />
                        <image
                          href={tag.logo}
                          x={left} y={yTop} width={CW} height={CH}
                          preserveAspectRatio="xMidYMid meet"
                        />
                        <rect
                          x={left} y={yTop} width={CW} height={CH} rx="3"
                          fill="none" stroke="rgba(24,24,27,0.16)" strokeWidth="1"
                        />
                        <text
                          x={x} y={yTop + CH + (narrow ? 12 : 14)}
                          textAnchor="middle" fontSize={FS}
                          fill="#a8a294"
                          style={{ fontFamily: "var(--font-mono), monospace" }}
                        >
                          {tag.count}
                        </text>
                      </>
                    ) : (
                      <>
                        <rect
                          x={left} y={yTop} width={CW} height={CH} rx="3"
                          fill="transparent" stroke="#d6d0c2" strokeWidth="1" strokeDasharray="3 3"
                        />
                        <text
                          x={x} y={yTop + CH / 2 + 4}
                          textAnchor="middle" fontSize={narrow ? 11 : 12.5} fontWeight="500"
                          fill="#9a9488"
                          style={{ fontFamily: "var(--font-body), Inter, sans-serif" }}
                        >
                          {tag.vendor}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      <p className="mt-1 border-t pt-4 text-xs leading-relaxed" style={{ borderColor: "#e4e0d8", color: "#6b675f" }}>
        One key reaches all of them, billed together in rupees. Switching vendor
        is one word in your request — no new account, no second card.
      </p>
    </figure>
  );
}
