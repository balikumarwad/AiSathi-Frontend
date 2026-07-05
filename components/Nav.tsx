"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

const LINKS = [
  { href: "/models", label: "Models" },
  { href: "/playground", label: "Playground" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/topup", label: "Top up" },
];

export default function Nav() {
  const [email, setEmail] = useState<string | null>(null);
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

  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-8 py-4 backdrop-blur-md"
      style={{
        background: "var(--surface-header)",
        borderBottom: "1px solid var(--border-hairline)",
      }}
    >
      <Link href="/" className="text-[22px] font-bold tracking-tight" style={{ color: "var(--text-strong)" }}>
        <span style={{ color: "var(--ev-red)" }}>AI</span>sathi
      </Link>
      <nav className="flex items-center gap-7 text-sm font-medium">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="transition-colors hover:text-white max-sm:hidden"
            style={{ color: pathname === l.href ? "var(--text-strong)" : "var(--text-muted)" }}
          >
            {l.label}
          </Link>
        ))}
        {email ? (
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] max-sm:hidden" style={{ color: "var(--text-muted)" }}>{email}</span>
            <Link
              href="/account"
              className="whitespace-nowrap px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors hover:border-zinc-400"
              style={{
                color: "var(--text-strong)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-xs)",
              }}
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
    </header>
  );
}
