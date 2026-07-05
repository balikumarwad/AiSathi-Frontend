"use client";

/**
 * Key-scoped dashboard: paste an API key, see the account behind it —
 * balance + recent usage. Full login UI is a later phase.
 */

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";

type Usage = {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_npr: number;
  status: string;
  created_at: string;
};

type Me = {
  dev_mode?: boolean;
  balance_npr: number | null;
  recent_usage: Usage[];
  key?: { name: string; prefix: string; created_at: string };
  note?: string;
};

export default function Dashboard() {
  const [apiKey, setApiKey] = useState("");
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setApiKey(localStorage.getItem("nepalai_key") ?? "");
  }, []);

  async function load() {
    setBusy(true);
    setError("");
    setMe(null);
    localStorage.setItem("nepalai_key", apiKey);
    try {
      const res = await fetch("/api/v1/me", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const json = await res.json();
      if (!res.ok) setError(json.error?.message ?? `Error ${res.status}`);
      else setMe(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="mt-6 flex gap-3">
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="np-… API key"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm outline-none focus:border-zinc-600"
          />
          <button
            onClick={load}
            disabled={busy || !apiKey}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-40"
          >
            {busy ? "Loading…" : "Load"}
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {me && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 p-5">
                <div className="text-sm text-zinc-400">Balance</div>
                <div className="mt-1 text-3xl font-bold">
                  {me.balance_npr === null ? "∞ (dev)" : `रू ${me.balance_npr.toLocaleString()}`}
                </div>
              </div>
              <div className="rounded-xl border border-zinc-800 p-5">
                <div className="text-sm text-zinc-400">Key</div>
                <div className="mt-1 text-lg font-semibold">
                  {me.key ? `${me.key.name} (${me.key.prefix}…)` : "dev key"}
                </div>
                {me.note && <p className="mt-1 text-xs text-zinc-500">{me.note}</p>}
              </div>
            </div>

            <h2 className="mt-10 text-lg font-semibold">Recent usage</h2>
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-zinc-400">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">When</th>
                    <th className="px-4 py-2.5 font-medium">Model</th>
                    <th className="px-4 py-2.5 font-medium">Tokens</th>
                    <th className="px-4 py-2.5 font-medium">Cost</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {me.recent_usage.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-3 text-zinc-500">
                        No usage yet.
                      </td>
                    </tr>
                  )}
                  {me.recent_usage.map((u, i) => (
                    <tr key={i} className="border-t border-zinc-800/60">
                      <td className="px-4 py-2 text-zinc-400">
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">{u.model}</td>
                      <td className="px-4 py-2 text-zinc-400">
                        {u.prompt_tokens}→{u.completion_tokens}
                      </td>
                      <td className="px-4 py-2">रू {u.cost_npr}</td>
                      <td className="px-4 py-2">
                        <span className={u.status === "ok" ? "text-green-400" : "text-red-400"}>
                          {u.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
