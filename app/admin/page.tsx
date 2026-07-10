"use client";

/**
 * Founder admin dashboard — feedback data + रू1,000 lucky draw.
 * Access: sign in with an admin email (lib/adminAuth allowlist). Everyone
 * else gets a 403 from the API and sees the access message.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Gift, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Stats = { total: number; up: number; down: number; month_entries: number; month_participants: number };
type Standing = { user_id: string; email: string; entries: number };
type Vote = { id: number; created_at: string; vote: "up" | "down"; model: string; question: string; answer: string; anonymous: boolean };
type Winner = { email: string; name: string | null; entries: number };

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

  const load = useCallback(async (token: string) => {
    const res = await fetch("/api/admin/feedback", { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 403) { setDenied(true); setReady(true); return; }
    const j = await res.json();
    setStats(j.stats); setStandings(j.standings ?? []); setRecent(j.recent ?? []);
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
        <h1 className="text-3xl font-bold">Admin — Feedback & Lucky Draw</h1>

        {!ready && <p className="mt-8 text-zinc-400">Loading…</p>}

        {ready && !session && (
          <p className="mt-8 text-zinc-400">
            <a href="/login" className="underline">Sign in</a> with the founder account to view this page.
          </p>
        )}

        {ready && session && denied && (
          <p className="mt-8 text-red-400">This account doesn&apos;t have admin access.</p>
        )}

        {ready && session && !denied && stats && (
          <>
            {/* Stats */}
            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-5">
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
