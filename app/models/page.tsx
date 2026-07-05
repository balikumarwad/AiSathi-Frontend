"use client";

import { useEffect, useMemo, useState } from "react";
import Nav from "@/components/Nav";

type Model = {
  id: string;
  name: string;
  context_length: number | null;
  pricing: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((j) => (j.data ? setModels(j.data) : setError(j.error?.message ?? "failed")))
      .catch((e) => setError(String(e)));
  }, []);

  const filtered = useMemo(
    () =>
      models.filter((m) =>
        (m.id + " " + m.name).toLowerCase().includes(query.toLowerCase()),
      ),
    [models, query],
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-bold">Models</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Prices in NPR per million tokens — FX and margin included, no surprises.
        </p>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search models…"
          className="mt-6 w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm outline-none focus:border-zinc-600"
        />
        {error && <p className="mt-6 text-sm text-red-400">{error}</p>}
        <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-900 text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Context</th>
                <th className="px-4 py-3 font-medium">Input (NPR/M)</th>
                <th className="px-4 py-3 font-medium">Output (NPR/M)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 100).map((m) => (
                <tr key={m.id} className="border-t border-zinc-800/60 hover:bg-zinc-900/50">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-zinc-500">{m.id}</div>
                  </td>
                  <td className="px-4 py-2.5 text-zinc-400">
                    {m.context_length?.toLocaleString() ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">रू {m.pricing.prompt_npr_per_m.toLocaleString()}</td>
                  <td className="px-4 py-2.5">रू {m.pricing.completion_npr_per_m.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p className="border-t border-zinc-800/60 px-4 py-2 text-xs text-zinc-500">
              Showing first 100 of {filtered.length} — refine your search.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
