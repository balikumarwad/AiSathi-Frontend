"use client";

/**
 * Login / signup — implements the AIsathi design (design/SathiAI.dc.html):
 * Bebas display "Welcome back", red script फेरि स्वागत छ, "Signing in as"
 * email chip with Change, Show/Hide password, red pill CTA. Two doors only:
 * Google one-tap or email+password (confirmation email link, kept ON).
 * Signup captures name (for greetings) + optional billing address.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Step = "email" | "password";

const inputStyle = {
  width: "100%",
  padding: "13px 16px",
  background: "var(--surface-inset)",
  color: "var(--text-strong)",
  fontSize: 15,
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--border-strong)",
  outline: "none",
} as const;

const pillBtn = {
  width: "100%",
  background: "var(--accent)",
  color: "var(--ev-white)",
  border: "none",
  borderRadius: "var(--radius-pill)",
  padding: 15,
  font: "700 14px var(--font-body)",
  letterSpacing: "0.02em",
  cursor: "pointer",
} as const;

export default function LoginPage() {
  const router = useRouter();
  const sb = supabaseBrowser();
  const [step, setStep] = useState<Step>("email");
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  // In-app browsers (LinkedIn, Facebook, Instagram, Messenger, TikTok, X...)
  // are blocked by Google OAuth ("403: disallowed_useragent"). Detect them so
  // we can steer users to a real browser instead of a dead-end Google error.
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setInApp(/LinkedInApp|FBAN|FBAV|FB_IAB|Instagram|Messenger|Snapchat|musical_ly|BytedanceWebview|Twitter|MicroMessenger|Line\//i.test(ua));
  }, []);

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
        // Instant signup: create a pre-confirmed account server-side, then sign
        // in right away. No email round-trip, so it works inside in-app
        // browsers (LinkedIn/Facebook/Instagram) where the email-link flow and
        // Google OAuth both break.
        const res = await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password, name: name.trim(), address: address.trim() }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(j.error ?? "Signup failed — please try again.");
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace("/account");
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
          : msg === "Invalid login credentials"
            ? "That doesn't look right — check your email and password, or reset below."
            : msg,
      );
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!sb) return;
    setBusy(true);
    setError("");
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/account` },
    });
    if (error) {
      setBusy(false);
      setError(
        error.message.toLowerCase().includes("provider")
          ? "Google sign-in isn't enabled yet — use email for now."
          : error.message,
      );
    }
    // On success the browser navigates to Google — no state to reset.
  }

  const microLabel = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  };

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <header className="p-6">
        <Link href="/" className="text-[22px] font-bold tracking-tight">
          <span style={{ color: "var(--ev-red)" }}>AI</span>sathi
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center px-6 pb-16 pt-14">
        <div className="w-full max-w-[420px] text-center">
          <h1
            className="m-0 font-[family-name:var(--font-display)] text-[40px] font-normal leading-none tracking-tight"
          >
            {isSignup ? "Create account" : "Welcome back"}
          </h1>
          <div
            className="mt-1.5 font-[family-name:var(--font-script)] text-xl"
            style={{ color: "var(--ev-red)" }}
          >
            {isSignup ? "खाता बनाउनुहोस्" : "फेरि स्वागत छ"}
          </div>
          <p className="mb-9 mt-2.5 text-[15px]" style={{ color: "var(--text-body)" }}>
            Your AI assistant, साथी, is ready when you are.
          </p>

          {!sb ? (
            <p className="text-sm text-yellow-400">Auth is not configured on this deployment.</p>
          ) : (
            <div className="space-y-4 text-left">
              {step === "email" && (
                <>
                  {inApp && (
                    <div
                      className="rounded-lg px-4 py-3 text-[13px] leading-relaxed"
                      style={{ background: "rgba(217, 160, 50, 0.12)", border: "1px solid rgba(217, 160, 50, 0.4)", color: "var(--text-body)" }}
                    >
                      <strong>Google sign-in doesn&apos;t work inside this app&apos;s browser</strong> (Google blocks it for security).
                      Tap the <strong>⋯ menu</strong> and choose <strong>&quot;Open in browser&quot;</strong> — or use email below, which works right here.
                    </div>
                  )}
                  <button
                    onClick={signInWithGoogle}
                    disabled={busy || inApp}
                    className="flex w-full items-center justify-center gap-3 py-3.5 text-sm font-semibold transition-colors disabled:opacity-40"
                    style={{
                      background: "var(--ev-white)",
                      color: "#0a0a0a",
                      border: "none",
                      borderRadius: "var(--radius-pill)",
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
                      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"/>
                      <path fill="#FBBC05" d="M5.27 14.29a7.16 7.16 0 0 1 0-4.58V6.62H1.29a12.04 12.04 0 0 0 0 10.76l3.98-3.09z"/>
                      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42A11.97 11.97 0 0 0 12 0 11.99 11.99 0 0 0 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
                    </svg>
                    Continue with Google
                  </button>

                  <div className="flex items-center gap-3 py-1 text-xs" style={{ color: "var(--text-faint)" }}>
                    <div className="h-px flex-1" style={{ background: "var(--border-hairline)" }} /> OR
                    <div className="h-px flex-1" style={{ background: "var(--border-hairline)" }} />
                  </div>

                  <div>
                    <div className="mb-1.5"><span style={microLabel}>Email</span></div>
                    <input
                      type="email"
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && continueWithEmail()}
                      placeholder="you@example.com"
                      style={inputStyle}
                    />
                  </div>
                  <button onClick={continueWithEmail} disabled={!email.includes("@")} style={pillBtn} className="disabled:opacity-40">
                    Continue — जारी राख्नुहोस्
                  </button>
                </>
              )}

              {step === "password" && (
                <>
                  <div>
                    <div className="mb-1.5"><span style={microLabel}>Signing in as</span></div>
                    <div
                      className="flex items-center justify-between"
                      style={{ ...inputStyle, padding: "13px 16px" }}
                    >
                      <span className="truncate text-[15px]">{email}</span>
                      <button
                        onClick={() => { setStep("email"); setError(""); }}
                        className="ml-3 flex-none text-[13px] font-semibold"
                        style={{ color: "var(--ev-red)" }}
                      >
                        Change
                      </button>
                    </div>
                  </div>
                  {isSignup && (
                    <>
                      <div>
                        <div className="mb-1.5"><span style={microLabel}>Your name</span></div>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="e.g. Oscar Neupane"
                          style={inputStyle}
                        />
                      </div>
                      <div>
                        <div className="mb-1.5"><span style={microLabel}>Billing address — optional</span></div>
                        <input
                          type="text"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="e.g. Kathmandu, Bagmati"
                          style={inputStyle}
                        />
                      </div>
                    </>
                  )}
                  <div>
                    <div className="mb-1.5"><span style={microLabel}>Password</span></div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        autoFocus
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                        placeholder={isSignup ? "Choose a password (min 6)" : "Enter your password"}
                        style={{ ...inputStyle, paddingRight: 60 }}
                      />
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div
                      className="flex items-start gap-2 p-3.5 text-left text-[13px] leading-relaxed"
                      style={{
                        background: "var(--ev-red-15)",
                        border: "1px solid var(--border-accent)",
                        borderRadius: "var(--radius-xs)",
                        color: "var(--text-strong)",
                      }}
                    >
                      {error}
                    </div>
                  )}

                  <button onClick={submitPassword} disabled={busy || password.length < 6} style={pillBtn} className="disabled:opacity-40">
                    {busy ? "One moment…" : isSignup ? "Create account — खाता बनाउनुहोस्" : "Sign in — साइन इन"}
                  </button>
                </>
              )}

              {notice && (
                <p
                  className="p-4 text-sm leading-relaxed"
                  style={{
                    border: "1px solid var(--border-strong)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--surface-inset)",
                    color: "var(--text-body)",
                  }}
                >
                  {notice}
                </p>
              )}

              <p className="pt-3 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                {isSignup ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                  onClick={() => { setIsSignup(!isSignup); setError(""); setNotice(""); }}
                  className="font-semibold"
                  style={{ color: "var(--ev-red)" }}
                >
                  {isSignup ? "Sign in" : "Sign up"}
                </button>
              </p>
            </div>
          )}
        </div>
      </main>

      <footer className="pb-6 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        AIsathi · तपाईंको AI साथी · <Link href="/" className="hover:underline">aisathi.io</Link>
      </footer>
    </div>
  );
}
