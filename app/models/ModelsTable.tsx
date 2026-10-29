"use client";

/**
 * Models catalog — implements the AIsathi design (design/SathiAI.dc.html):
 * Inter display title, plain-language NPR explainer, search, pill filter
 * chips, hairline table with uppercase headers, Free/badges in red outline.
 */

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Model = {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

type Filter = "all" | "free" | "cheap" | "premium";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "free", label: "Free" },
  { key: "cheap", label: "Cheap" },
  { key: "premium", label: "Premium" },
];

function fmtPrice(n: number): ReactNode {
  if (n === 0) return "Free";
  return <><span lang="ne">रू</span>{Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2)}</>;
}

function tagOf(m: Model): Filter {
  const p = m.pricing.prompt_npr_per_m;
  if (p === 0 && m.pricing.completion_npr_per_m === 0) return "free";
  if (p < 50) return "cheap";
  if (p >= 300) return "premium";
  return "all";
}

export default function ModelsTable({ initial }: { initial: Model[] }) {
  const [models, setModels] = useState<Model[]>(initial);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initial.length);

  // The server renders the table already. This only runs when that came back
  // empty — a build with no upstream key, or a cold ISR miss — so the page
  // still fills in rather than showing a crawler-friendly but human-hostile
  // empty state.
  useEffect(() => {
    if (initial.length) return;
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((j) => (j.data ? setModels(j.data) : setError(j.error?.message ?? "failed")))
      .catch(() => setError("Could not load models. Please reload to retry."))
      .finally(() => setLoading(false));
  }, [initial.length]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return models.filter((m) => {
      const matchesQuery = !q || (m.id + " " + m.name).toLowerCase().includes(q);
      const matchesFilter = filter === "all" || tagOf(m) === filter;
      return matchesQuery && matchesFilter;
    });
  }, [models, query, filter]);

  const th = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  };

  return (
    <>
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1100px] px-6 pb-20 pt-10">
        <h1 className="m-0 mb-2 font-[family-name:var(--font-display)] text-[34px] font-normal tracking-tight">
          Models
        </h1>
        <p className="m-0 mb-6 max-w-[640px] text-[15px] leading-relaxed" style={{ color: "var(--text-body)" }}>
          Prices are already converted to Nepali Rupees per million tokens — roughly 750,000
          words. FX and our margin are included, so the number you see is what you pay.
        </p>

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search models" placeholder="Search models…"
          className="mb-4 w-full text-sm outline-none"
          style={{
            padding: "13px 16px",
            background: "var(--surface-inset)",
            color: "var(--text-strong)",
            borderRadius: "var(--radius-xs)",
            border: "1px solid var(--border-strong)",
          }}
        />

        <div className="mb-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key} aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className="px-4 py-[7px] text-[13px] font-semibold transition-colors"
              style={{
                borderRadius: "var(--radius-pill)",
                border: "1px solid " + (filter === f.key ? "var(--ev-red)" : "var(--border-strong)"),
                background: filter === f.key ? "var(--ev-red-15)" : "transparent",
                color: filter === f.key ? "var(--ev-white)" : "var(--text-muted)",
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <p role="status" className="mb-4 text-sm">Loading model prices…</p>}
        {error && <p className="mb-4 text-sm" style={{ color: "var(--ev-red)" }}>{error}</p>}

        <div style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
          <div
            className="grid px-5 py-3.5 max-sm:hidden"
            style={{
              gridTemplateColumns: "2.2fr 1fr 1fr 1fr",
              background: "var(--ev-white-02)",
              borderBottom: "1px solid var(--border-hairline)",
            }}
          >
            <span style={th}>Model</span>
            <span style={th} title="How much text the model can read at once, in tokens (~0.75 words each).">
              Context ⓘ
            </span>
            <span style={th}>Input · NPR/1M</span>
            <span style={th}>Output · NPR/1M</span>
          </div>
          {filtered.slice(0, 120).map((m) => {
            const free = tagOf(m) === "free";
            return (
              <div
                key={m.id}
                className="grid items-center gap-y-1 px-5 py-4 max-sm:grid-cols-1 sm:[grid-template-columns:2.2fr_1fr_1fr_1fr]"
                style={{ borderBottom: "1px solid var(--border-hairline)" }}
              >
                <div>
                  <div className="leading-snug">
                    <span className="text-[15px] font-semibold">{m.name}</span>
                    {free && (
                      <span
                        className="ml-2 inline-block align-middle text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          padding: "2px 7px",
                          borderRadius: "var(--radius-xs)",
                          border: "1px solid var(--border-accent)",
                          color: "var(--ev-red)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Free
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 break-all font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--text-faint)" }}>
                    {m.id}
                  </div>
                </div>
                <span className="text-sm" style={{ color: "var(--text-body)" }}>
                  <span className="mr-2 text-xs text-zinc-400 sm:hidden">Context tokens</span>
                  {m.context_length?.toLocaleString() ?? "—"}
                </span>
                <span className="text-sm font-semibold"><span className="mr-2 text-xs font-normal text-zinc-400 sm:hidden">Input / M tokens</span>{fmtPrice(m.pricing.prompt_npr_per_m)}</span>
                <span className="text-sm font-semibold"><span className="mr-2 text-xs font-normal text-zinc-400 sm:hidden">Output / M tokens</span>{fmtPrice(m.pricing.completion_npr_per_m)}</span>
              </div>
            );
          })}
          {filtered.length === 0 && !error && !loading && (
            <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              No models match &quot;{query}&quot;. Try a different search or clear the filter.
            </div>
          )}
          {filtered.length > 120 && (
            <p className="px-5 py-2.5 text-xs" style={{ color: "var(--text-faint)" }}>
              Showing first 120 of {filtered.length} — refine your search.
            </p>
          )}
        </div>
      </main>

    </>
  );
}
