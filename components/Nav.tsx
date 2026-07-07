"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const LINKS = [
  { href: "/models", label: "Models" },
  { href: "/playground", label: "Playground" },
  { href: "/docs", label: "Docs" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/topup", label: "Top up" },
];

export default function Nav() {
  const [email, setEmail] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) =>
      setEmail(s?.user.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  // Close the mobile menu whenever the route changes.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-md"
      style={{
        background: "var(--surface-header)",
        borderBottom: "1px solid var(--border-hairline)",
      }}
    >
      <div className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" className="group flex items-center gap-2.5 text-[22px] font-bold tracking-tight" style={{ color: "var(--text-strong)" }}>
          {/* Lockup: ink rhino in front of a red rising sun. On hover the sun
              swells and the rhino breaks into a gallop (animated loader swap). */}
          <span className="relative flex h-8 w-12 flex-none items-center justify-center">
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-300 group-hover:scale-125"
              style={{ background: "var(--ev-red)" }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rhino.svg" alt="" className="relative h-6 w-auto group-hover:hidden" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/rhino-loader.svg" alt="" aria-hidden className="relative hidden h-7 w-auto group-hover:block" />
          </span>
          <span>
            <span style={{ color: "var(--ev-red)" }}>AI</span>sathi
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 text-sm font-medium sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="transition-colors hover:text-white"
              style={{ color: pathname === l.href ? "var(--text-strong)" : "var(--text-muted)" }}
            >
              {l.label}
            </Link>
          ))}
          {email ? (
            <div className="flex items-center gap-2.5">
              <span className="text-[13px] max-lg:hidden" style={{ color: "var(--text-muted)" }}>{email}</span>
              <Link
                href="/account"
                className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:border-zinc-400"
                style={{ color: "var(--text-strong)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-xs)" }}
              >
                Account
              </Link>
            </div>
          ) : (
            <Link
              href="/login"
              className="whitespace-nowrap px-5 py-2 text-[13px] font-bold text-white transition-colors"
              style={{ background: "var(--accent)", borderRadius: "var(--radius-pill)" }}
            >
              Sign in
            </Link>
          )}
        </nav>

        {/* Mobile: primary CTA + hamburger */}
        <div className="flex items-center gap-2 sm:hidden">
          <Link
            href={email ? "/account" : "/login"}
            className="whitespace-nowrap px-4 py-1.5 text-xs font-bold text-white"
            style={{ background: "var(--accent)", borderRadius: "var(--radius-pill)" }}
          >
            {email ? "Account" : "Sign in"}
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-md"
            style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {open && (
        <nav className="flex flex-col gap-1 px-5 pb-4 sm:hidden" style={{ borderTop: "1px solid var(--border-hairline)" }}>
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors hover:bg-white/5"
              style={{ color: pathname === l.href ? "var(--text-strong)" : "var(--text-muted)" }}
            >
              {l.label}
            </Link>
          ))}
          {email && (
            <span className="px-3 pt-2 text-xs" style={{ color: "var(--text-faint)" }}>{email}</span>
          )}
        </nav>
      )}
    </header>
  );
}
