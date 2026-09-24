"use client";

/**
 * The three value cards, each with a picture that argues its own claim.
 *
 * They used to be an icon, a heading and a sentence — three identical grey
 * rectangles, and the reader had to take all three on trust. Each now carries
 * a small visual that IS the evidence:
 *
 *   Local payments  three rails arriving at one balance
 *   NPR pricing     the real price range, plotted from the live catalogue
 *   Drop-in API     the base URL swap, which is the entire integration
 *
 * The middle one is live, so the card cannot drift from what we actually
 * charge. The other two are structural and do not need data.
 *
 * Only the price plot needs the catalogue, and it reads the shared memoised
 * fetch — the page still makes one request for it however many components ask.
 */

import { useEffect, useState } from "react";

import { loadCatalogue } from "@/lib/catalogue";

const CARD =
  "group overflow-hidden rounded-2xl border border-zinc-800 bg-[var(--elevated)] transition hover:border-zinc-600";
const FRAME = "border-b border-zinc-800 bg-[var(--surface)] px-5 py-4";

/* ---------------------------------------------------------------- payments */
/* Three rails, one balance. The curves converge because that is the product:
   the reader's mental model is three separate top-up methods, and the point is
   that they land in the same place. */
function Rails() {
  const methods = ["eSewa", "Khalti", "Card"];
  return (
    <svg viewBox="0 0 260 96" className="h-24 w-full" role="img" aria-label="eSewa, Khalti and card top-ups all arrive in one balance.">
      {methods.map((m, i) => {
        const y = 18 + i * 30;
        return (
          <g key={m}>
            <path
              d={`M 86 ${y} C 130 ${y}, 140 48, 170 48`}
              fill="none"
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
            <rect x="6" y={y - 11} width="80" height="22" rx="11"
              fill="var(--elevated)" stroke="var(--border-strong)" strokeWidth="1" />
            <text x="46" y={y + 4} textAnchor="middle" fontSize="11.5" fill="var(--text-2)"
              style={{ fontFamily: "var(--font-body), Inter, sans-serif" }}>
              {m}
            </text>
          </g>
        );
      })}
      <circle cx="180" cy="48" r="4" fill="var(--primary)" />
      <rect x="190" y="34" width="66" height="28" rx="14"
        fill="var(--primary)" opacity="0.14" stroke="var(--primary)" strokeWidth="1" />
      <text x="223" y="52.5" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="var(--primary)"
        style={{ fontFamily: "var(--font-body), Inter, sans-serif" }}>
        one balance
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ prices */
/* The real spread, on a log axis — linear would pile 90% of the catalogue into
   the first two pixels, because the range is roughly 8,800x. */
function PriceScale() {
  const [prices, setPrices] = useState<number[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadCatalogue().then((models) => {
      if (!alive || !models.length) return;
      setPrices(models.map((m) => Number(m.pricing?.prompt_npr_per_m ?? 0)));
    });
    return () => { alive = false; };
  }, []);

  const paid = (prices ?? []).filter((p) => p > 0);
  const free = (prices ?? []).length - paid.length;
  const lo = paid.length ? Math.min(...paid) : 4;
  const hi = paid.length ? Math.max(...paid) : 3500;
  const at = (p: number) =>
    22 + ((Math.log(p) - Math.log(lo)) / (Math.log(hi) - Math.log(lo) || 1)) * 214;

  const fmt = (n: number) =>
    n >= 1000 ? `${Math.round(n / 1000)}k` : n >= 10 ? String(Math.round(n)) : n.toFixed(1);

  return (
    <svg viewBox="0 0 260 96" className="h-24 w-full" role="img"
      aria-label={paid.length ? `Prices run from about रू${fmt(lo)} to रू${fmt(hi)} per million tokens, plus ${free} free models.` : "Price range per million tokens."}>
      <line x1="10" y1="58" x2="250" y2="58" stroke="var(--border-strong)" strokeWidth="1" />

      {/* every paid model, one tick */}
      {paid.map((p, i) => (
        <line key={i} x1={at(p)} y1="48" x2={at(p)} y2="58"
          stroke="var(--primary)" strokeWidth="1" opacity="0.28" />
      ))}

      {/* free models sit off the scale, because zero has no logarithm — and
          pretending they are "very cheap" would understate the offer */}
      <circle cx="10" cy="58" r="4" fill="var(--primary)" />
      <text x="10" y="76" textAnchor="start" fontSize="10" fill="var(--text-2)"
        style={{ fontFamily: "var(--font-mono), monospace" }}>
        {free ? `${free} free` : "free"}
      </text>

      <text x="250" y="76" textAnchor="end" fontSize="10" fill="var(--text-2)"
        style={{ fontFamily: "var(--font-mono), monospace" }}>
        <tspan lang="ne">रू</tspan>{fmt(hi)}/M
      </text>
      <text x="10" y="34" textAnchor="start" fontSize="11" fontWeight="600" fill="var(--text)"
        style={{ fontFamily: "var(--font-body), Inter, sans-serif" }}>
        {paid.length ? `${paid.length + free} models, priced in rupees` : "priced in rupees"}
      </text>
    </svg>
  );
}

/* --------------------------------------------------------------------- API */
/* The whole integration, shown at actual size. */
function BaseUrlSwap() {
  return (
    <div className="flex h-24 flex-col justify-center gap-1.5" role="img"
      aria-label="Change the base URL from api.openai.com to aisathi.io; the rest of your code is unchanged.">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
        base_url
      </span>
      <span className="truncate font-mono text-[11.5px] text-zinc-500 line-through decoration-zinc-600">
        https://api.openai.com/v1
      </span>
      <span className="truncate font-mono text-[11.5px] font-medium" style={{ color: "var(--primary)" }}>
        https://aisathi.io/api/v1
      </span>
      <span className="font-mono text-[10px] text-zinc-500">…everything else unchanged</span>
    </div>
  );
}

/* ------------------------------------------------------------------- cards */
const CARDS = [
  {
    visual: <Rails />,
    title: "Local payments",
    body: "Top up credits with eSewa or Khalti in seconds — or card via Stripe from anywhere.",
  },
  {
    visual: <PriceScale />,
    title: "NPR pricing",
    body: "Transparent per-token prices in rupees. Start free. No FX surprises.",
  },
  {
    visual: <BaseUrlSwap />,
    title: "Drop-in API",
    body: "OpenAI-compatible. Point any SDK at our base URL — your code doesn't change.",
  },
];

export default function ValueCards() {
  return (
    <div className="mt-16 grid gap-6 sm:grid-cols-3">
      {CARDS.map((c) => (
        <div key={c.title} className={CARD}>
          <div className={FRAME}>{c.visual}</div>
          <div className="p-6">
            <div className="font-[family-name:var(--font-display)] text-xl font-semibold">
              {c.title}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{c.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
