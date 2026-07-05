"use client";

/**
 * Login / signup — implements the AIsathi design (design/SathiAI.dc.html):
 * Bebas display "Welcome back", red script फेरि स्वागत छ, "Signing in as"
 * email chip with Change, Show/Hide password, red pill CTA. Real Supabase
 * auth underneath: password sign-in/up + magic link, confirmation kept ON.
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
  const [showPassword, setShowPassword] = useState(false);
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
            "✉️ खाता बन्यो! We sent a confirmation email — click the link inside, then sign in.",
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
          : msg === "Invalid login credentials"
            ? "That doesn't look right — check your email and password, or reset below."
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
                  <div className="flex items-center gap-3 py-1 text-xs" style={{ color: "var(--text-faint)" }}>
                    <div className="h-px flex-1" style={{ background: "var(--border-hairline)" }} /> OR
                    <div className="h-px flex-1" style={{ background: "var(--border-hairline)" }} />
                  </div>
                  <button
                    onClick={sendMagicLink}
                    disabled={busy || !email.includes("@")}
                    className="w-full py-3.5 text-sm font-semibold transition-colors disabled:opacity-40"
                    style={{
                      background: "transparent",
                      color: "var(--text-strong)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: "var(--radius-pill)",
                    }}
                  >
                    ✨ {busy ? "Sending…" : "Email me a magic link"}
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
