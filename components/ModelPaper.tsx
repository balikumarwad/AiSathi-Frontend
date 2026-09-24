"use client";

/**
 * The vendor board: every AI we serve, pegged to a string like a pinboard.
 *
 * A deliberate light island on a dark page — the rest of the site is the
 * product, this is the wall it gets planned on.
 *
 * The tags carry vendor NAMES, not logos. A dozen third-party marks would be a
 * dozen trademarked files to license, keep current and ship, and at this size
 * a name is more legible than a mark anyway.
 *
 * Colours are literal hex rather than Tailwind classes. Nearly every colour
 * class on this site is remapped to a dark token in globals.css, so a
 * `text-zinc-900` here would resolve to a dark-theme surface and fight the
 * paper. This element opts out of the theme on purpose, and says so.
 */

import { useEffect, useState } from "react";

import { loadCatalogue, vendorOf } from "@/lib/catalogue";

/* Shown until the catalogue lands, and kept if it never does. Real counts from
   the 2026-09-25 snapshot, so the board is never blank — and the caption only
   claims "live" once rows actually arrive. */
const FALLBACK: [string, number][] = [
  ["OpenAI", 104], ["Qwen", 54], ["Google", 43], ["Anthropic", 32],
  ["Mistral", 23], ["Z.ai", 21], ["DeepSeek", 19], ["Meta", 13],
  ["Moonshot", 9], ["xAI", 9], ["MiniMax", 8], ["NVIDIA", 8],
  ["Tencent", 7], ["Aion Labs", 6], ["Cohere", 6], ["Amazon", 5],
  ["Perplexity", 5], ["Xiaomi", 5], ["Poolside", 4], ["Sakana", 4],
  ["Nous Research", 3], ["Microsoft", 2], ["IBM Granite", 2], ["StepFun", 2],
  ["Baidu", 1],
];

type Tag = { label: string; count: number | null };

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
      setRows([...byVendor].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
      setTotal(models.length);
    });
    return () => { alive = false; };
  }, []);

  // A pinboard is not an index: it shows enough to make the point and admits
  // how much it left out. The complete list lives at /models.
  const shown = narrow ? 11 : 21;
  const tags: Tag[] = rows.slice(0, shown).map(([label, count]) => ({ label, count }));
  if (rows.length > shown) tags.push({ label: `+${rows.length - shown} more`, count: null });

  const W = narrow ? 420 : 1040;
  const LINES = narrow ? 5 : 4;
  const PAD = narrow ? 14 : 28;
  const TOP = narrow ? 30 : 38;
  const GAP = narrow ? 98 : 104;
  const TH = narrow ? 28 : 33;   // tag height
  const FS = narrow ? 12 : 14;   // label size
  const CS = FS - 3.5;           // the count, a size down
  // Contiguous slices, so the heaviest vendors hang on the top string and the
  // long tail settles to the bottom — the board still reads top-down.
  const per = Math.ceil(tags.length / LINES);
  // ...and the height follows the strings actually used, not the strings asked
  // for. Ceil-dividing 12 tags over 5 lines fills 4 and leaves the fifth empty,
  // which on a phone was a blank third of the sheet.
  const used = Math.ceil(tags.length / per);
  const H = TOP + (used - 1) * GAP + 92;

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
          {total ? `${total} models · ${rows.length} vendors · live` : `${rows.length} vendors`}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="mt-1 block h-auto"
        role="img"
        aria-label={`AI vendors AIsathi serves: ${rows.slice(0, shown).map(([v]) => v).join(", ")}${rows.length > shown ? `, and ${rows.length - shown} more` : ""}.`}
      >
        {Array.from({ length: used }, (_, line) => {
          const group = tags.slice(line * per, line * per + per);
          if (!group.length) return null;

          const y = TOP + line * GAP;
          const sag = narrow ? 12 : 18;
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
                const x = PAD + step * (i + 0.5) + (noise(tag.label, 1) - 0.5) * step * 0.22;
                const pin = dip(x);
                const yTop = pin + (narrow ? 12 : 15) + noise(tag.label, 2) * (narrow ? 12 : 20);
                const tilt = (noise(tag.label, 3) - 0.5) * 7;
                const muted = tag.count === null;
                // Name and count each get their own column: sizing the tag off
                // the name alone printed them on top of each other ("OpenAI104").
                // Inter runs ~0.58em average at this weight, the mono count
                // ~0.62em, and the rest is padding — a hand-pinned tag is
                // allowed to be loose.
                const nameW = tag.label.length * FS * 0.58;
                const countW = muted ? 0 : String(tag.count).length * CS * 0.62 + 9;
                const tw = Math.max(nameW + countW + 26, 66);
                const left = x - tw / 2;

                return (
                  <g key={tag.label} transform={`rotate(${tilt} ${x} ${pin})`}>
                    <line x1={x} y1={pin} x2={x} y2={yTop} stroke="#cdc7ba" strokeWidth="1" />
                    {/* the peg: a stub across the string, so the tag reads as
                        clipped on rather than floating under it */}
                    <rect x={x - 4} y={pin - 3.5} width="8" height="7" rx="2" fill="#b9b2a2" />
                    {!muted && (
                      <rect
                        x={left + 1.5} y={yTop + 2} width={tw} height={TH} rx="4"
                        fill="rgba(24,24,27,0.07)"
                      />
                    )}
                    <rect
                      x={left}
                      y={yTop}
                      width={tw}
                      height={TH}
                      rx="4"
                      fill={muted ? "transparent" : "#ffffff"}
                      stroke={muted ? "#d6d0c2" : "#e2ded3"}
                      strokeWidth="1"
                      strokeDasharray={muted ? "3 3" : undefined}
                    />
                    <text
                      x={muted ? x : left + 13}
                      y={yTop + TH / 2 + FS * 0.35}
                      textAnchor={muted ? "middle" : "start"}
                      fontSize={FS}
                      fontWeight="500"
                      fill={muted ? "#9a9488" : "#18181b"}
                      style={{ fontFamily: "var(--font-body), Inter, sans-serif" }}
                    >
                      {tag.label}
                    </text>
                    {!muted && (
                      <text
                        x={left + tw - 11}
                        y={yTop + TH / 2 + FS * 0.32}
                        textAnchor="end"
                        fontSize={CS}
                        fill="#a8a294"
                        style={{ fontFamily: "var(--font-mono), monospace" }}
                      >
                        {tag.count}
                      </text>
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
