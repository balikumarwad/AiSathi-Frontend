"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

export default function Nav() {
  const [email, setEmail] = useState<string | null>(null);

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
    <nav className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <Link href="/" className="text-lg font-bold tracking-tight">
        Sathi<span className="text-red-500">AI</span>
      </Link>
      <div className="flex items-center gap-6 text-sm text-zinc-400">
        <Link href="/models" className="hover:text-white">Models</Link>
        <Link href="/playground" className="hover:text-white">Playground</Link>
        <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
        <Link href="/topup" className="font-medium text-purple-400 hover:text-purple-300">Top up</Link>
        {email ? (
          <Link
            href="/account"
            className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs hover:border-zinc-500"
            title={email}
          >
            {email.split("@")[0]}
          </Link>
        ) : (
          <Link
            href="/login"
            className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-500"
          >
            Sign in
          </Link>
        )}
      </div>
    </nav>
  );
}
