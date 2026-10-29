"use client";

/**
 * Top-up page, two modes:
 *   - normal visit: pick an amount -> /api/topup/initiate -> redirect to Khalti
 *   - return from Khalti (?pidx=…): -> /api/topup/verify -> show result
 */

import { Suspense, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";

const PRESETS = [200, 500, 1000, 2500];

type Plan = {
  id: string;
  market: "np" | "intl";
  display_name: string;
  currency: string;
  price: number;
  credit_npr: number;
};

function TopupInner() {
  const params = useSearchParams();
  const pidx = params.get("pidx");
  const stripeResult = params.get("stripe"); // success | cancel

  const [apiKey, setApiKey] = useState("");
  const [amount, setAmount] = useState(500);
  const [market, setMarket] = useState<"np" | "intl">("np");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ status: string; credited_npr?: number; balance_npr?: number; note?: string } | null>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("nepalai_key") ?? "");
    fetch("/api/v1/plans")
      .then((r) => { if (!r.ok) throw new Error("Plans unavailable"); return r.json(); })
      .then((j) => setPlans((j.data ?? []).filter((p: Plan) => p.market)))
      .catch(() => setPlansError(true))
      .finally(() => setPlansLoading(false));
  }, []);

  async function buyPlan(plan: Plan) {
    setBusy(true);
    setError("");
    localStorage.setItem("nepalai_key", apiKey);
    const endpoint = plan.market === "np" ? "/api/topup/initiate" : "/api/stripe/checkout";
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ plan_id: plan.id }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error?.message ?? `Error ${res.status}`);
      else window.location.href = json.payment_url ?? json.checkout_url;
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  // Return-from-Khalti mode: verify immediately.
  useEffect(() => {
    if (!pidx) return;
    setBusy(true);
    fetch("/api/topup/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pidx }),
    })
      .then((r) => r.json())
      .then((j) => (j.error ? setError(j.error.message) : setResult(j)))
      .catch((e) => setError(String(e)))
      .finally(() => setBusy(false));
  }, [pidx]);

  async function startTopup() {
    setBusy(true);
    setError("");
    localStorage.setItem("nepalai_key", apiKey);
    try {
      const res = await fetch("/api/topup/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ amount_npr: amount }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error?.message ?? `Error ${res.status}`);
      else window.location.href = json.payment_url; // off to Khalti
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-md px-6 py-14">
      <div className="workspace-identity">AIsathi / Credits & balance</div><h1 className="text-2xl font-bold">Top up credits</h1>

      {pidx ? (
        <div className="mt-8 rounded-xl border border-zinc-800 p-6">
          {busy && <p className="text-zinc-400">Verifying payment with Khalti…</p>}
          {error && <p role="alert" className="text-red-400">{error}</p>}
          {result && result.status === "completed" && (
            <>
              <p className="flex items-center gap-2 text-2xl"><CheckCircle2 className="text-green-400" /> Payment verified</p>
              {result.credited_npr !== undefined && (
                <p className="mt-3 text-zinc-300">
                  Added <b>{(result.credited_npr * 10).toLocaleString()} credits</b>
                  {result.balance_npr !== undefined && (
                    <> — new balance <b>{(result.balance_npr * 10).toLocaleString()} credits</b></>
                  )}
                </p>
              )}
              {result.note && <p className="mt-2 text-sm text-zinc-500">{result.note}</p>}
            </>
          )}
          {result && result.status !== "completed" && (
            <p className="text-yellow-400">Payment status: {result.status}. Check your balance before trying again.</p>
          )}
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {stripeResult === "success" && (
            <div className="flex items-center gap-2 rounded-lg border border-green-800 bg-green-900/20 p-3 text-sm text-green-300">
              <CheckCircle2 size={16} className="flex-none" /> Returned from Stripe checkout. Payment is not confirmed here; check your usage dashboard for the verified balance.
            </div>
          )}
          {stripeResult === "cancel" && (
            <div className="rounded-lg border border-yellow-800 bg-yellow-900/20 p-3 text-sm text-yellow-300">
              Checkout was cancelled. If you see a bank charge, check your account balance or contact support.
            </div>
          )}
          <input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            aria-label="API key for this top-up" type="password" autoComplete="off" placeholder="np-… API key"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-zinc-600"
          />

          {/* Market switch (spec §5): NP -> Khalti, Intl -> Stripe */}
          <div className="flex rounded-lg border border-zinc-800 p-1 text-sm">
            {(["np", "intl"] as const).map((m) => (
              <button
                key={m}
                aria-pressed={market === m}
                onClick={() => setMarket(m)}
                className={
                  "flex-1 rounded-md px-3 py-1.5 " +
                  (market === m ? "bg-zinc-800 font-medium" : "text-zinc-500 hover:text-zinc-300")
                }
              >
                {m === "np" ? "Nepal (Khalti)" : "International (card)"}
              </button>
            ))}
          </div>

          {/* Plans for the selected market */}
          {plansLoading && <p role="status" className="home-copy">Loading top-up plans…</p>}
          {plansError && <p role="alert" className="home-copy">Plans could not be loaded. Reload to retry.</p>}
          {!plansLoading && !plansError && !plans.some(p => p.market === market) && <p className="home-copy">No plans are available for this market right now.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {plans
              .filter((p) => p.market === market)
              .map((p) => (
                <button
                  key={p.id}
                  onClick={() => buyPlan(p)}
                  disabled={busy || !apiKey}
                  className="rounded-xl border border-zinc-800 p-4 text-left hover:border-zinc-500 disabled:opacity-40"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{p.display_name}</span>
                    {p.currency === "NPR" && Number(p.credit_npr) > Number(p.price) && (
                      <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-400">
                        +{Math.round((Number(p.credit_npr) / Number(p.price) - 1) * 100)}% bonus
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-2xl font-bold">
                    {p.currency === "NPR" ? <span lang="ne">रू</span> : "$"}
                    {Number(p.price).toLocaleString()}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {(Number(p.credit_npr) * 10).toLocaleString()} credits
                  </div>
                </button>
              ))}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          {market === "intl" ? (
            <p className="text-xs text-zinc-500">
              Card payments are processed by Stripe. Prices in USD.
            </p>
          ) : (
          <>
          <p className="pt-2 text-xs uppercase tracking-wider text-zinc-500">or a custom amount</p>
          <div className="flex gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                aria-pressed={amount === p}
                onClick={() => setAmount(p)}
                className={
                  "flex-1 rounded-lg border px-3 py-2 text-sm " +
                  (amount === p ? "border-[var(--primary)] bg-[var(--primary-ghost)]" : "border-zinc-800 hover:border-zinc-600")
                }
              >
                <span lang="ne">रू</span> {p}
              </button>
            ))}
          </div>
          <input
            aria-label="Top-up amount in Nepali rupees"
            type="number"
            value={amount}
            min={50}
            max={50000}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-zinc-600"
          />
          <button
            onClick={startTopup}
            disabled={busy || !apiKey.trim() || !Number.isFinite(amount) || amount < 50 || amount > 50000}
            className="w-full rounded-lg bg-purple-600 px-5 py-3 font-medium hover:bg-purple-500 disabled:opacity-40"
          >
            {busy ? "Starting…" : <>Pay <span lang="ne">रू</span> {amount.toLocaleString()} with Khalti</>}
          </button>
          <p className="text-xs text-zinc-500">
            Minimum <span lang="ne">रू</span>50. You&apos;ll be taken to Khalti to pay, then brought back here.
          </p>
          </>
          )}
        </div>
      )}
    </main>
  );
}

export default function TopupPage() {
  return (
    <div className="workspace-page min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <Suspense fallback={<main className="mx-auto max-w-md px-6 py-14 text-zinc-400">Loading…</main>}>
        <TopupInner />
      </Suspense>
    </div>
  );
}
