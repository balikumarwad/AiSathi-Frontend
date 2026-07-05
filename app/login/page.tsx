"use client";

/**
 * Login / signup — two methods, one page:
 *   - Password: classic email + password (signup sends a confirmation email)
 *   - Magic link: passwordless, emails a one-click sign-in link
 * On success you land in /account. All auth goes through Supabase; this page
 * only ever touches the public anon key.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Mode = "signin" | "signup" | "magic";

export default function LoginPage() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // Already signed in? Straight to the account page.
  useEffect(() => {
    sb?.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/account");
    });
  }, [sb, router]);

  async function submit() {
    if (!sb) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (mode === "magic") {
        const { error } = await sb.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: `${window.location.origin}/account` },
        });
        if (error) throw error;
        setNotice("✉️ Magic link sent — check your inbox and click it.");
      } else if (mode === "signup") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/account` },
        });
        if (error) throw error;
        if (data.session) router.replace("/account");
        else setNotice("✉️ Account created — confirm your email, then sign in.");
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace("/account");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, label: string) => (
    <button
      key={m}
      onClick={() => { setMode(m); setError(""); setNotice(""); }}
      className={
        "flex-1 rounded-md px-3 py-1.5 text-sm " +
        (mode === m ? "bg-zinc-800 font-medium" : "text-zinc-500 hover:text-zinc-300")
      }
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">
          {mode === "signup" ? "Create your account" : "Welcome back, साथी"}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          One account for API keys, credits, and the playground.
        </p>

        {!sb ? (
          <p className="mt-8 text-sm text-yellow-400">Auth is not configured on this deployment.</p>
        ) : (
          <div className="mt-8 space-y-4">
            <div className="flex rounded-lg border border-zinc-800 p-1">
              {tab("signin", "Sign in")}
              {tab("signup", "Sign up")}
              {tab("magic", "Magic link")}
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-zinc-600"
            />
            {mode !== "magic" && (
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder={mode === "signup" ? "choose a password (min 6 chars)" : "password"}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-zinc-600"
              />
            )}

            <button
              onClick={submit}
              disabled={busy || !email.includes("@") || (mode !== "magic" && password.length < 6)}
              className="w-full rounded-lg bg-red-600 px-5 py-3 font-medium hover:bg-red-500 disabled:opacity-40"
            >
              {busy
                ? "Working…"
                : mode === "signup"
                  ? "Create account"
                  : mode === "magic"
                    ? "Email me a magic link"
                    : "Sign in"}
            </button>

            {notice && (
              <p className="rounded-lg border border-green-800 bg-green-900/20 p-3 text-sm text-green-300">{notice}</p>
            )}
            {error && <p className="text-sm text-red-400">{error}</p>}

            <p className="pt-2 text-xs text-zinc-500">
              {mode === "signin" ? (
                <>No account? <button onClick={() => setMode("signup")} className="text-purple-400 hover:text-purple-300">Sign up</button> — takes 20 seconds.</>
              ) : (
                <>Already have one? <button onClick={() => setMode("signin")} className="text-purple-400 hover:text-purple-300">Sign in</button></>
              )}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
