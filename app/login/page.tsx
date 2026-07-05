"use client";

/**
 * Login / signup — ChatGPT-style: one centered card, email first, then the
 * password step. Magic link as the passwordless alternative. Nepali touches
 * throughout. Auth = Supabase (browser only ever holds the public anon key).
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Step = "email" | "password";

export default function LoginPage() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [step, setStep] = useState<Step>("email");
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    sb?.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/account");
    });
  }, [sb, router]);

  function continueWithEmail() {
    if (!email.includes("@")) return;
    setError("");
    setStep("password");
  }

  async function submitPassword() {
    if (!sb || password.length < 6) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (isSignup) {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/account` },
        });
        if (error) throw error;
        if (data.session) router.replace("/account");
        else
          setNotice(
            "✉️ खाता बन्यो! We sent a confirmation email — click the link inside, then sign in. (Delivery can take a few minutes; check spam too.)",
          );
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        router.replace("/account");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg === "Email not confirmed"
          ? "इमेल पुष्टि भएको छैन — click the link in your confirmation email first (check spam)."
          : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendMagicLink() {
    if (!sb || !email.includes("@")) return;
    setBusy(true);
    setError("");
    try {
      const { error } = await sb.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${window.location.origin}/account` },
      });
      if (error) throw error;
      setNotice("✨ जादुई लिङ्क पठाइयो! Check your inbox and click the link to sign in.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const input =
    "w-full rounded-full border border-zinc-700 bg-zinc-900/80 px-5 py-3.5 text-sm outline-none transition focus:border-red-500";
  const primary =
    "w-full rounded-full bg-red-600 px-5 py-3.5 text-sm font-semibold transition hover:bg-red-500 disabled:opacity-40";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {/* Minimal header, ChatGPT-style: just the wordmark */}
      <header className="p-6">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Sathi<span className="text-red-500">AI</span>
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-24">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl">🙏</div>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-3xl font-bold">
            {isSignup ? "खाता बनाउनुहोस्" : "फेरि स्वागत छ"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {isSignup ? "Create your account" : "Welcome back"} — your AI साथी is waiting.
          </p>

          {!sb ? (
            <p className="mt-10 text-sm text-yellow-400">Auth is not configured on this deployment.</p>
          ) : (
            <div className="mt-10 space-y-3 text-left">
              {step === "email" && (
                <>
                  <input
                    type="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && continueWithEmail()}
                    placeholder="Email address / इमेल"
                    className={input}
                  />
                  <button onClick={continueWithEmail} disabled={!email.includes("@")} className={primary}>
                    जारी राख्नुहोस् — Continue
                  </button>

                  <div className="flex items-center gap-3 py-2 text-xs text-zinc-600">
                    <div className="h-px flex-1 bg-zinc-800" /> OR <div className="h-px flex-1 bg-zinc-800" />
                  </div>

                  <button
                    onClick={sendMagicLink}
                    disabled={busy || !email.includes("@")}
                    className="w-full rounded-full border border-zinc-700 px-5 py-3.5 text-sm font-medium transition hover:border-zinc-500 disabled:opacity-40"
                  >
                    ✨ {busy ? "Sending…" : "Email me a magic link"}
                  </button>
                </>
              )}

              {step === "password" && (
                <>
                  <button
                    onClick={() => { setStep("email"); setError(""); }}
                    className="w-full truncate rounded-full border border-zinc-800 px-5 py-3 text-center text-sm text-zinc-400 hover:border-zinc-600"
                    title="change email"
                  >
                    {email} <span className="text-zinc-600">· change</span>
                  </button>
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                    placeholder={isSignup ? "Choose a password (min 6) / पासवर्ड" : "Password / पासवर्ड"}
                    className={input}
                  />
                  <button onClick={submitPassword} disabled={busy || password.length < 6} className={primary}>
                    {busy ? "One moment…" : isSignup ? "खाता बनाउनुहोस् — Create account" : "साइन इन — Sign in"}
                  </button>
                </>
              )}

              {notice && (
                <p className="rounded-2xl border border-green-800 bg-green-900/20 p-4 text-sm leading-relaxed text-green-300">
                  {notice}
                </p>
              )}
              {error && <p className="px-2 text-sm text-red-400">{error}</p>}

              <p className="pt-4 text-center text-sm text-zinc-500">
                {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  onClick={() => { setIsSignup(!isSignup); setError(""); setNotice(""); }}
                  className="font-medium text-red-400 hover:text-red-300"
                >
                  {isSignup ? "Sign in" : "Sign up"}
                </button>
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="pb-6 text-center text-xs text-zinc-600">
        SathiAI · तपाईंको AI साथी · <Link href="/" className="hover:text-zinc-400">aisathi.io</Link>
      </footer>
    </div>
  );
}
