"use client";

/**
 * Account: sign in with a magic link (Supabase email OTP), then manage your
 * API keys — create (plaintext shown ONCE), list, revoke. The page talks to
 * /api/keys with the Supabase session token; key hashes live server-side.
 */

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type KeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  active: boolean;
  created_at: string;
  last_used_at: string | null;
};

export default function AccountPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [newKey, setNewKey] = useState("");
  const [keyName, setKeyName] = useState("my-app");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sb = supabaseBrowser();

  const loadKeys = useCallback(async (token: string) => {
    const res = await fetch("/api/keys", { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (res.ok) setKeys(json.data ?? []);
  }, []);

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadKeys(data.session.access_token);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) loadKeys(s.access_token);
    });
    return () => sub.subscription.unsubscribe();
  }, [sb, loadKeys]);

  async function createKey() {
    if (!session) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ name: keyName }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error?.message ?? `Error ${res.status}`);
    setNewKey(json.key);
    localStorage.setItem("nepalai_key", json.key); // playground picks it up
    loadKeys(session.access_token);
  }

  async function revoke(id: string) {
    if (!session) return;
    await fetch("/api/keys", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ id }),
    });
    loadKeys(session.access_token);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Account</h1>

        {!sb && (
          <p className="mt-6 text-sm text-yellow-400">Auth is not configured on this deployment.</p>
        )}

        {sb && !session && (
          <div className="mt-8">
            <p className="text-zinc-400">You&apos;re not signed in.</p>
            <a
              href="/login"
              className="mt-4 inline-block rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium hover:bg-red-500"
            >
              Sign in / create account →
            </a>
          </div>
        )}

        {sb && session && (
          <div className="mt-8 space-y-8">
            <div className="flex items-center justify-between rounded-xl border border-zinc-800 p-4">
              <div>
                <div className="text-sm text-zinc-400">
                  नमस्ते{session.user.user_metadata?.full_name ? `, ${String(session.user.user_metadata.full_name).split(" ")[0]}` : ""} 🙏
                </div>
                <div className="font-medium">
                  {(session.user.user_metadata?.full_name as string) ?? session.user.email}
                </div>
                <div className="text-xs text-zinc-500">{session.user.email}</div>
              </div>
              <button
                onClick={() => sb.auth.signOut()}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:border-zinc-500"
              >
                Sign out
              </button>
            </div>

            {newKey && (
              <div className="rounded-xl border border-green-800 bg-green-900/20 p-4">
                <div className="text-sm font-medium text-green-300">
                  Your new API key — copy it now, it will never be shown again:
                </div>
                <code className="mt-2 block break-all rounded bg-black/50 p-3 font-[family-name:var(--font-mono)] text-sm">
                  {newKey}
                </code>
                <p className="mt-2 text-xs text-zinc-400">
                  (Also saved to this browser for the playground.)
                </p>
              </div>
            )}

            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold">API keys</h2>
              <div className="mt-3 flex gap-3">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder="key name"
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm outline-none focus:border-zinc-600"
                />
                <button
                  onClick={createKey}
                  disabled={busy}
                  className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-40"
                >
                  Create key
                </button>
              </div>
              {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
              <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-900 text-zinc-400">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Name</th>
                      <th className="px-4 py-2.5 font-medium">Key</th>
                      <th className="px-4 py-2.5 font-medium">Created</th>
                      <th className="px-4 py-2.5 font-medium">Status</th>
                      <th className="px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {keys.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-zinc-500">No keys yet — create one above.</td>
                      </tr>
                    )}
                    {keys.map((k) => (
                      <tr key={k.id} className="border-t border-zinc-800/60">
                        <td className="px-4 py-2">{k.name}</td>
                        <td className="px-4 py-2 font-[family-name:var(--font-mono)] text-zinc-400">{k.key_prefix}…</td>
                        <td className="px-4 py-2 text-zinc-400">{new Date(k.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <span className={k.active ? "text-green-400" : "text-zinc-500"}>
                            {k.active ? "active" : "revoked"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right">
                          {k.active && (
                            <button onClick={() => revoke(k.id)} className="text-xs text-red-400 hover:text-red-300">
                              revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-sm text-zinc-500">
              Next: <a href="/topup" className="text-purple-400 hover:text-purple-300">top up credits</a> and{" "}
              <a href="/playground" className="text-purple-400 hover:text-purple-300">try your key in the playground</a>.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
