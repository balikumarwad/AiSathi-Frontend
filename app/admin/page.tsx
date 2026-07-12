"use client";

/**
 * Founder admin dashboard — feedback data + रू1,000 lucky draw.
 * Access: sign in with an admin email (lib/adminAuth allowlist). Everyone
 * else gets a 403 from the API and sees the access message.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Activity, AlertTriangle, Coins, Gift, ThumbsDown, ThumbsUp, Trophy, Users } from "lucide-react";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Stats = { total: number; up: number; down: number; month_entries: number; month_participants: number };
type Standing = { user_id: string; email: string; entries: number };
type Vote = { id: number; created_at: string; vote: "up" | "down"; model: string; question: string; answer: string; anonymous: boolean };
type Winner = { email: string; name: string | null; entries: number };
type Metrics = {
  totals: { requests: number; users: number; ok: number; errors: number; cost_npr: number; upstream_usd: number; tokens: number };
  today: { requests: number; cost_npr: number; users: number };
  daily: { day: string; requests: number; errors: number; cost_npr: number }[];
  models: { model: string; requests: number; errors: number; cost_npr: number }[];
};

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [denied, setDenied] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [standings, setStandings] = useState<Standing[]>([]);
  const [recent, setRecent] = useState<Vote[]>([]);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"all" | "down">("all");
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  const load = useCallback(async (token: string) => {
    const auth = { Authorization: `Bearer ${token}` };
    const [fb, mt] = await Promise.all([
      fetch("/api/admin/feedback", { headers: auth }),
      fetch("/api/admin/metrics?days=14", { headers: auth }),
    ]);
    if (fb.status === 403) { setDenied(true); setReady(true); return; }
    const j = await fb.json();
    setStats(j.stats); setStandings(j.standings ?? []); setRecent(j.recent ?? []);
    if (mt.ok) setMetrics(await mt.json());
    setReady(true);
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) { setReady(true); return; }
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) load(data.session.access_token); else setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) load(s.access_token);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  async function pickWinner() {
    if (!session) return;
    if (!confirm("Pick this month's रू1,000 winner now? Every signed-in vote this month is one entry.")) return;
    setDrawing(true); setError("");
    try {
      const res = await fetch("/api/admin/draw", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
      const j = await res.json();
      if (!res.ok) setError(j.error ?? `Error ${res.status}`);
      else { setWinner(j.winner); setTotalEntries(j.total_entries); }
    } finally { setDrawing(false); }
  }

  const shown = tab === "down" ? recent.filter((r) => r.vote === "down") : recent;

  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-3xl font-bold">AISathi Admin</h1>

        {!ready && <p className="mt-8 text-zinc-400">Loading…</p>}

        {ready && !session && (
          <p className="mt-8 text-zinc-400">
            <a href="/login" className="underline">Sign in</a> with the founder account to view this page.
          </p>
        )}

        {ready && session && denied && (
          <p className="mt-8 text-red-400">This account doesn&apos;t have admin access.</p>
        )}

        {ready && session && !denied && metrics && (() => {
          const t = metrics.totals;
          const successRate = t.requests ? Math.round((t.ok / t.requests) * 100) : 100;
          const maxReq = Math.max(1, ...metrics.daily.map((d) => d.requests));
          return (
            <section className="mt-8">
              <h2 className="flex items-center gap-2 text-xl font-bold"><Activity size={20} className="text-blue-400" /> Monitoring — last 14 days</h2>

              {/* Stat cards */}
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { icon: Activity, label: "Requests", value: t.requests.toLocaleString(), tone: "text-blue-400" },
                  { icon: AlertTriangle, label: "Success rate", value: successRate + "%", tone: successRate >= 90 ? "text-emerald-400" : successRate >= 75 ? "text-amber-400" : "text-red-400" },
                  { icon: Users, label: "Active users", value: t.users, tone: "text-purple-400" },
                  { icon: Coins, label: "Revenue (रू)", value: Number(t.cost_npr).toLocaleString(), tone: "text-emerald-400" },
                  { icon: Coins, label: "Upstream cost", value: "$" + Number(t.upstream_usd).toFixed(2), tone: "text-zinc-300" },
                  { icon: Activity, label: "Today", value: metrics.today.requests + " req", tone: "text-blue-400" },
                ].map((c) => (
                  <div key={c.label} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500"><c.icon size={13} /> {c.label}</div>
                    <div className={`mt-1 text-2xl font-bold ${c.tone}`}>{c.value}</div>
                  </div>
                ))}
              </div>

              {/* Requests-per-day chart (green = ok, red = failed) */}
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="mb-3 flex items-center justify-between text-xs text-zinc-500">
                  <span>Requests per day</span>
                  <span className="flex items-center gap-3">
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/70" /> ok</span>
                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-red-500/80" /> failed</span>
                  </span>
                </div>
                <div className="flex h-40 items-end gap-1.5">
                  {metrics.daily.map((d) => (
                    <div key={d.day} className="flex h-full flex-1 flex-col justify-end" title={`${d.day}\n${d.requests} requests · ${d.errors} failed · रू${d.cost_npr}`}>
                      <div className="flex w-full flex-col-reverse overflow-hidden rounded-t" style={{ height: `${Math.round((d.requests / maxReq) * 100)}%`, minHeight: d.requests ? 2 : 0 }}>
                        <div className="bg-red-500/80" style={{ flexGrow: d.errors }} />
                        <div className="bg-emerald-500/70" style={{ flexGrow: Math.max(0, d.requests - d.errors) }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between text-[10px] text-zinc-600">
                  <span>{metrics.daily[0]?.day.slice(5)}</span>
                  <span>{metrics.daily[metrics.daily.length - 1]?.day.slice(5)}</span>
                </div>
              </div>

              {/* Top models */}
              <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
                <div className="mb-2 text-sm font-semibold">Model usage & cost</div>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-zinc-500">
                    <th className="py-1.5">Model</th>
                    <th className="py-1.5 text-right">Requests</th>
                    <th className="py-1.5 text-right">Fail %</th>
                    <th className="py-1.5 text-right">Cost (रू)</th>
                  </tr></thead>
                  <tbody>
                    {metrics.models.map((m) => {
                      const fail = m.requests ? Math.round((m.errors / m.requests) * 100) : 0;
                      return (
                        <tr key={m.model} className="border-t border-zinc-800/60">
                          <td className="py-1.5 font-mono text-[13px]">{m.model}</td>
                          <td className="py-1.5 text-right">{m.requests}</td>
                          <td className={`py-1.5 text-right ${fail >= 25 ? "text-red-400" : fail > 0 ? "text-amber-400" : "text-zinc-500"}`}>{fail}%</td>
                          <td className="py-1.5 text-right">{Number(m.cost_npr).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })()}

        {ready && session && !denied && stats && (
          <>
            <h2 className="mt-12 text-xl font-bold">Feedback & Lucky Draw</h2>
            {/* Stats */}
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
              {[
                ["Total votes", stats.total],
                ["Thumbs up", stats.up],
                ["Thumbs down", stats.down],
                ["Entries this month", stats.month_entries],
                ["Participants", stats.month_participants],
              ].map(([label, n]) => (
                <div key={String(label)} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                  <div className="text-xs text-zinc-500">{label}</div>
                  <div className="mt-1 text-2xl font-bold">{n}</div>
                </div>
              ))}
            </div>

            {/* Lucky draw */}
            <section className="mt-10 rounded-2xl border border-green-900/60 bg-green-950/20 p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="flex items-center gap-2 text-xl font-bold"><Gift size={20} className="text-green-400" /> रू1,000 Lucky Draw — this month</h2>
                <button
                  onClick={pickWinner}
                  disabled={drawing || stats.month_entries === 0}
                  className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-green-500 disabled:opacity-40"
                >
                  {drawing ? "Drawing…" : "Pick winner"}
                </button>
              </div>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              {winner && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-green-700 bg-green-900/30 p-4">
                  <Trophy size={28} className="flex-none text-yellow-400" />
                  <div>
                    <div className="text-lg font-bold">{winner.name ?? winner.email}</div>
                    <div className="text-sm text-zinc-300">{winner.email} · {winner.entries} of {totalEntries} entries</div>
                    <div className="mt-1 text-xs text-zinc-500">Pay रू1,000 via eSewa/Khalti, then announce the winner publicly.</div>
                  </div>
                </div>
              )}
              {standings.length > 0 ? (
                <table className="mt-4 w-full text-sm">
                  <thead><tr className="text-left text-zinc-500"><th className="py-1.5">Participant</th><th className="py-1.5 text-right">Entries</th></tr></thead>
                  <tbody>
                    {standings.map((s) => (
                      <tr key={s.user_id} className="border-t border-zinc-800/60">
                        <td className="py-1.5">{s.email}</td>
                        <td className="py-1.5 text-right font-semibold">{s.entries}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">No signed-in votes yet this month — share the campaign!</p>
              )}
            </section>

            {/* Votes */}
            <section className="mt-10">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold">Recent votes</h2>
                <div className="flex gap-2 text-sm">
                  <button onClick={() => setTab("all")} className={`rounded-lg px-3 py-1.5 ${tab === "all" ? "bg-zinc-800 font-semibold" : "text-zinc-500"}`}>All</button>
                  <button onClick={() => setTab("down")} className={`rounded-lg px-3 py-1.5 ${tab === "down" ? "bg-zinc-800 font-semibold" : "text-zinc-500"}`}>👎 only (RAG gaps)</button>
                </div>
              </div>
              {shown.length === 0 && <p className="mt-4 text-sm text-zinc-500">Nothing here yet.</p>}
              <div className="mt-4 space-y-3">
                {shown.map((r) => (
                  <div key={r.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex items-center gap-3 text-xs text-zinc-500">
                      {r.vote === "up" ? <ThumbsUp size={14} className="text-green-400" /> : <ThumbsDown size={14} className="text-red-400" />}
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                      <span className="font-mono">{r.model?.split("/").pop()}</span>
                      {r.anonymous && <span className="rounded bg-zinc-800 px-1.5 py-0.5">anonymous</span>}
                    </div>
                    <div className="mt-2 text-sm font-semibold">{r.question || "(no question)"}</div>
                    <div className="mt-1 line-clamp-3 text-sm text-zinc-400">{r.answer}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </>
  );
}
