"use client";

/**
 * Dashboard — renders automatically for signed-in users (session-authed
 * /api/account/usage aggregates across all their keys). The paste-a-key
 * path remains only for signed-out developers checking a key.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Usage = {
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_npr: number;
  status: string;
  created_at: string;
  key?: string;
};

type AccountUsage = {
  balance_npr: number;
  total_spent_npr: number;
  active_keys: number;
  recent_usage: Usage[];
};

const card = {
  border: "1px solid var(--border-hairline)",
  borderRadius: "var(--radius-sm)",
  background: "var(--ev-white-02)",
} as const;

export default function Dashboard() {
  const [session, setSession] = useState<Session | null>(null);
  const [data, setData] = useState<AccountUsage | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  const loadSession = useCallback(async (s: Session) => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/usage", {
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) setError(json.error?.message ?? `Error ${res.status}`);
      else setData(json);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return setChecked(true);
    sb.auth.getSession().then(({ data: d }) => {
      setSession(d.session);
      setChecked(true);
      if (d.session) loadSession(d.session);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadSession]);

  async function loadByKey() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/v1/me", { headers: { Authorization: `Bearer ${apiKey}` } });
      const json = await res.json();
      if (!res.ok) setError(json.error?.message ?? `Error ${res.status}`);
      else
        setData({
          balance_npr: json.balance_npr,
          total_spent_npr: NaN,
          active_keys: 1,
          recent_usage: json.recent_usage ?? [],
        });
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  const name =
    (session?.user.user_metadata?.full_name as string | undefined)?.split(" ")[0] ??
    session?.user.email?.split("@")[0];

  return (
    <div className="min-h-screen" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="m-0 font-[family-name:var(--font-display)] text-[34px] font-normal tracking-tight">
          Dashboard
        </h1>
        {session && (
          <p className="mt-1 text-sm" style={{ color: "var(--text-muted)" }}>
            नमस्ते, {name} 🙏 — your usage updates automatically.
          </p>
        )}

        {checked && !session && (
          <div className="mt-8 space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="/login"
                className="px-6 py-3 text-[13px] font-bold text-white no-underline"
                style={{ background: "var(--accent)", borderRadius: "var(--radius-pill)" }}
              >
                Sign in to see your dashboard
              </a>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                or check a single key:
              </span>
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="np-… API key"
                className="min-w-56 flex-1 px-4 py-2.5 text-sm outline-none"
                style={{
                  background: "var(--surface-inset)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-xs)",
                  color: "var(--text-strong)",
                }}
              />
              <button
                onClick={loadByKey}
                disabled={busy || !apiKey}
                className="px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                style={{ background: "var(--accent)", borderRadius: "var(--radius-xs)", border: "none" }}
              >
                {busy ? "Loading…" : "Load"}
              </button>
            </div>
          </div>
        )}

        {error && <p className="mt-4 text-sm" style={{ color: "var(--ev-red)" }}>{error}</p>}
        {busy && !data && <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>Loading your usage…</p>}

        {data && (
          <>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="p-5" style={card}>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Balance
                </div>
                <div className="mt-1 text-3xl font-bold">
                  रू {Number(data.balance_npr ?? 0).toLocaleString()}
                </div>
                <a href="/topup" className="mt-1 inline-block text-xs font-semibold no-underline" style={{ color: "var(--ev-red)" }}>
                  Top up →
                </a>
              </div>
              <div className="p-5" style={card}>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Total spent
                </div>
                <div className="mt-1 text-3xl font-bold">
                  {Number.isNaN(data.total_spent_npr) ? "—" : `रू ${data.total_spent_npr.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                </div>
              </div>
              <div className="p-5" style={card}>
                <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                  Active keys
                </div>
                <div className="mt-1 text-3xl font-bold">{data.active_keys}</div>
                <a href="/account" className="mt-1 inline-block text-xs font-semibold no-underline" style={{ color: "var(--ev-red)" }}>
                  Manage →
                </a>
              </div>
            </div>

            <h2 className="mb-3 mt-10 text-lg font-semibold">Recent usage</h2>
            <div className="overflow-x-auto" style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-sm)" }}>
              <table className="w-full text-left text-sm">
                <thead style={{ background: "var(--ev-white-02)", color: "var(--text-muted)" }}>
                  <tr>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">When</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Model</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Key</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Tokens</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Cost</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_usage.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-3" style={{ color: "var(--text-muted)" }}>
                        No usage yet — try the <a href="/playground" style={{ color: "var(--ev-red)" }}>playground</a>.
                      </td>
                    </tr>
                  )}
                  {data.recent_usage.map((u, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border-hairline)" }}>
                      <td className="px-4 py-2" style={{ color: "var(--text-muted)" }}>
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">{u.model}</td>
                      <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-xs" style={{ color: "var(--text-muted)" }}>
                        {u.key ?? "—"}
                      </td>
                      <td className="px-4 py-2" style={{ color: "var(--text-muted)" }}>
                        {u.prompt_tokens}→{u.completion_tokens}
                      </td>
                      <td className="px-4 py-2">रू {u.cost_npr}</td>
                      <td className="px-4 py-2">
                        <span style={{ color: u.status === "ok" ? "#4ade80" : "var(--ev-red)" }}>{u.status}</span>
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
