"use client";

/**
 * Code verification — the link-free path. The confirmation email carries a
 * 6-digit code ({{ .Token }}); entering it here verifies the account and
 * signs the user in, immune to expired links, DNS hiccups, and Gmail link
 * scanners. Works for signup confirmations and magic-link codes alike.
 */

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

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

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const sb = supabaseBrowser();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function verify() {
    if (!sb || !email.includes("@") || code.trim().length < 4) return;
    setBusy(true);
    setError("");
    // Signup confirmations use type "signup"; magic-link / re-sent codes use
    // "email". Try both so the user never has to care which email they got.
    let lastError = "";
    for (const type of ["signup", "email"] as const) {
      const { data, error } = await sb.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type,
      });
      if (!error && data.session) {
        router.replace("/account");
        return;
      }
      lastError = error?.message ?? "Verification failed";
    }
    setBusy(false);
    setError(
      lastError.includes("expired") || lastError.includes("invalid")
        ? "That code is invalid or has expired — codes work once and last 1 hour. Sign up or sign in again to get a fresh one."
        : lastError,
    );
  }

  const microLabel = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "var(--text-muted)",
  };

  return (
    <div className="w-full max-w-[420px] text-center">
      <h1 className="m-0 font-[family-name:var(--font-display)] text-[40px] font-normal leading-none tracking-tight">
        Enter your code
      </h1>
      <div className="mt-1.5 font-[family-name:var(--font-script)] text-xl" style={{ color: "var(--ev-red)" }}>
        कोड हाल्नुहोस्
      </div>
      <p className="mb-9 mt-2.5 text-[15px]" style={{ color: "var(--text-body)" }}>
        We emailed you a one-time code. Enter it below and you&apos;re verified — no link needed.
      </p>

      {!sb ? (
        <p className="text-sm text-yellow-400">Auth is not configured on this deployment.</p>
      ) : (
        <div className="space-y-4 text-left">
          <div>
            <div className="mb-1.5"><span style={microLabel}>Email</span></div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>
          <div>
            <div className="mb-1.5"><span style={microLabel}>Code from your email</span></div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && verify()}
              placeholder="00000000"
              className="text-center font-[family-name:var(--font-mono)] !text-2xl tracking-[0.4em]"
              style={{ ...inputStyle, fontSize: 24, letterSpacing: "0.4em" }}
            />
          </div>

          {error && (
            <div
              className="p-3.5 text-left text-[13px] leading-relaxed"
              style={{
                background: "var(--ev-red-15)",
                border: "1px solid var(--border-accent)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              {error}
            </div>
          )}

          <button
            onClick={verify}
            disabled={busy || !email.includes("@") || code.trim().length < 4}
            className="w-full p-[15px] text-sm font-bold text-white disabled:opacity-40"
            style={{ background: "var(--accent)", border: "none", borderRadius: "var(--radius-pill)", cursor: "pointer" }}
          >
            {busy ? "Verifying…" : "Verify — प्रमाणित गर्नुहोस्"}
          </button>

          <p className="pt-2 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            No code?{" "}
            <Link href="/login" className="font-semibold no-underline" style={{ color: "var(--ev-red)" }}>
              Sign up / sign in again
            </Link>{" "}
            to get a fresh one.
          </p>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <header className="p-6">
        <Link href="/" className="text-[22px] font-bold tracking-tight">
          <span style={{ color: "var(--ev-red)" }}>AI</span>sathi
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center px-6 pb-16 pt-14">
        <Suspense fallback={null}>
          <VerifyForm />
        </Suspense>
      </main>
      <footer className="pb-6 text-center text-xs" style={{ color: "var(--text-faint)" }}>
        AIsathi · तपाईंको AI साथी · aisathi.io
      </footer>
    </div>
  );
}
