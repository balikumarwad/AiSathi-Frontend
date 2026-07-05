"use client";

/**
 * Playground — Claude-style chat with AIsathi personality:
 *  - left sidebar with conversation history (stored in the browser)
 *  - time-aware Nepali/English greeting on the empty state
 *  - composer with the model picker + send built in
 *  - streaming, per-message रू cost, free tier, auto key for signed-in users
 * Talks to our public gateway exactly like an external developer would.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Msg = { role: "user" | "assistant"; content: string; costNpr?: number | null };
type Chat = { id: string; title: string; messages: Msg[]; updated: number };
type CatalogModel = {
  id: string;
  name?: string;
  pricing?: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

const SUGGESTIONS = [
  { icon: "🏔️", text: "Write a short poem about the Himalayas in Nepali" },
  { icon: "🥟", text: "Explain how AI works using a momo-making analogy" },
  { icon: "💻", text: "Write a Python function and explain it line by line" },
  { icon: "🧳", text: "Plan a perfect 3-day trip to Pokhara on a budget" },
];

function isFree(m: CatalogModel) {
  return !!m.pricing && m.pricing.prompt_npr_per_m === 0 && m.pricing.completion_npr_per_m === 0;
}

function fmtPrice(m: CatalogModel) {
  if (!m.pricing) return "";
  if (isFree(m)) return "Free";
  return `रू${m.pricing.prompt_npr_per_m} / रू${m.pricing.completion_npr_per_m}`;
}

function greeting(name?: string) {
  const h = new Date().getHours();
  const [np, en] =
    h < 12 ? ["शुभ प्रभात", "Good morning"] : h < 17 ? ["नमस्ते", "Good afternoon"] : ["शुभ सन्ध्या", "Good evening"];
  return { np, en: name ? `${en}, ${name}` : en };
}

/** OpenRouter-style model picker, compact — lives inside the composer. */
function ModelPicker({
  models,
  model,
  onPick,
}: {
  models: CatalogModel[];
  model: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const ql = q.trim().toLowerCase();
  const match = (m: CatalogModel) =>
    !ql || m.id.toLowerCase().includes(ql) || (m.name ?? "").toLowerCase().includes(ql);
  const free = models.filter(isFree).filter(match);
  const paid = models.filter((m) => !isFree(m)).filter(match);

  const groupLabel = {
    padding: "8px 16px 4px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    color: "var(--text-faint)",
  };

  const row = (m: CatalogModel) => (
    <button
      key={m.id}
      onClick={() => { onPick(m.id); setOpen(false); setQ(""); }}
      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
      style={{ background: m.id === model ? "var(--ev-red-15)" : "transparent" }}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm" style={{ color: "var(--text-strong)" }}>{m.name ?? m.id}</span>
        <span className="block truncate font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--text-faint)" }}>{m.id}</span>
      </span>
      <span className="flex-none text-xs font-semibold" style={{ color: isFree(m) ? "#4ade80" : "var(--text-muted)" }}>
        {fmtPrice(m)}
      </span>
    </button>
  );

  const shortName = model.split("/").pop() ?? model;

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex max-w-[45vw] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 sm:max-w-xs"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border-hairline)" }}
        title={model}
      >
        <span className="truncate">{shortName}</span>
        <span style={{ color: "var(--text-faint)" }}>▾</span>
      </button>
      {open && (
        <div
          className="absolute bottom-full z-30 mb-2 w-[420px] max-w-[85vw] overflow-hidden"
          style={{
            background: "#131313",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
          }}
        >
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${models.length} models…`}
            className="w-full px-4 py-3 text-sm outline-none"
            style={{ background: "transparent", borderBottom: "1px solid var(--border-hairline)", color: "var(--text-strong)" }}
          />
          <div className="sathi-scroll max-h-72 overflow-y-auto pb-1">
            {free.length > 0 && <div style={groupLabel}>🆓 Free — works without credits</div>}
            {free.slice(0, 30).map(row)}
            {paid.length > 0 && <div style={groupLabel}>⚡ Paid — रू in / out per 1M tokens</div>}
            {paid.slice(0, 80).map(row)}
            {free.length + paid.length === 0 && (
              <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>No models match &quot;{q}&quot;</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Minimal renderer: alternate prose / fenced code so replies read cleanly. */
function Content({ text }: { text: string }) {
  const parts = text.split("```");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <pre
            key={i}
            className="my-3 overflow-x-auto p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed"
            style={{ background: "rgba(0,0,0,0.55)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-hairline)" }}
          >
            {part.replace(/^[a-z0-9+-]*\n/i, "")}
          </pre>
        ) : (
          <span key={i} className="whitespace-pre-wrap">{part}</span>
        ),
      )}
    </>
  );
}

const newChatId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function Playground() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState<string>("");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chat = chats.find((c) => c.id === chatId) ?? null;
  const messages = chat?.messages ?? [];

  // ---- storage ----
  useEffect(() => {
    setApiKey(localStorage.getItem("nepalai_key") ?? "");
    try {
      const saved = JSON.parse(localStorage.getItem("aisathi_chats") ?? "[]") as Chat[];
      setChats(saved);
      if (saved[0]) setChatId(saved[0].id);
    } catch { /* fresh start */ }
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((j) => setModels(j.data ?? []))
      .catch(() => {});
  }, []);

  const persist = useCallback((next: Chat[]) => {
    setChats(next);
    try { localStorage.setItem("aisathi_chats", JSON.stringify(next.slice(0, 30))); } catch { /* full */ }
  }, []);

  // ---- auth: auto-key for signed-in users ----
  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let cancelled = false;
    sb.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      const existing = localStorage.getItem("nepalai_key");
      if (!data.session || existing) return;
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ name: "chat" }),
      });
      const json = await res.json().catch(() => null);
      if (!cancelled && res.ok && json?.key) {
        localStorage.setItem("nepalai_key", json.key);
        setApiKey(json.key);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const refreshBalance = useCallback((key: string) => {
    if (!key) return setBalance(null);
    fetch("/api/v1/me", { headers: { Authorization: `Bearer ${key}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setBalance(j ? j.balance_npr : null))
      .catch(() => setBalance(null));
  }, []);
  useEffect(() => { refreshBalance(apiKey); }, [apiKey, refreshBalance]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chats, chatId]);

  // ---- chat ops ----
  function startNewChat() {
    setChatId("");
    setError("");
    inputRef.current?.focus();
  }

  function deleteChat(id: string) {
    const next = chats.filter((c) => c.id !== id);
    persist(next);
    if (chatId === id) setChatId(next[0]?.id ?? "");
  }

  function updateChat(id: string, msgs: Msg[], all: Chat[]): Chat[] {
    return all
      .map((c) => (c.id === id ? { ...c, messages: msgs, updated: Date.now() } : c))
      .sort((a, b) => b.updated - a.updated);
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    if (!apiKey.trim()) {
      setError(session ? "Setting up your account key — try again in a second." : "Sign in to start chatting.");
      return;
    }
    setError("");
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";

    // create the chat lazily on first message
    let id = chatId;
    let all = chats;
    if (!chat) {
      id = newChatId();
      all = [{ id, title: content.slice(0, 42), messages: [], updated: Date.now() }, ...chats];
      setChatId(id);
    }
    const base = all.find((c) => c.id === id)!.messages;
    const next: Msg[] = [...base, { role: "user", content }];
    all = updateChat(id, next, all);
    persist(all);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: next.map(({ role, content }) => ({ role, content })),
          stream: true,
        }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? `Error ${res.status}`);
        return;
      }
      let reply = "";
      let cost: number | null = null;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            if (j.nepalai) {
              cost = j.nepalai.cost_npr ?? null;
              if (j.nepalai.balance_npr != null) setBalance(j.nepalai.balance_npr);
            }
            const delta = j.choices?.[0]?.delta?.content;
            if (delta) {
              reply += delta;
              all = updateChat(id, [...next, { role: "assistant", content: reply }], all);
              setChats(all);
            }
          } catch { /* partial line */ }
        }
      }
      persist(updateChat(id, [...next, { role: "assistant", content: reply || "(empty reply)", costNpr: cost }], all));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  const fullName =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    (session?.user.user_metadata?.name as string | undefined);
  const firstName = fullName?.trim().split(/\s+/)[0];
  const g = greeting(firstName);
  const waiting = busy && messages.length > 0 && messages[messages.length - 1].role === "user";

  const composer = (
    <div className="w-full">
      {error && <p className="mb-2 text-xs" style={{ color: "var(--ev-red)" }}>{error}</p>}
      <div
        className="flex flex-col gap-2 p-3"
        style={{ background: "#141414", border: "1px solid var(--border-strong)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
          }}
          placeholder={apiKey ? "साथीलाई सोध्नुहोस् — ask your साथी anything…" : "Sign in to start chatting…"}
          disabled={!apiKey && !session}
          className="max-h-44 w-full resize-none bg-transparent px-2 pt-1 text-[15px] outline-none placeholder:text-zinc-600"
          style={{ color: "var(--text-strong)" }}
        />
        <div className="flex items-center gap-2">
          <ModelPicker models={models} model={model} onPick={setModel} />
          {balance !== null && (
            <span className="hidden text-xs sm:inline" style={{ color: "var(--text-faint)" }}>रू {balance}</span>
          )}
          <div className="flex-1" />
          {busy ? (
            <button
              onClick={() => abortRef.current?.abort()}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}
              title="Stop"
            >
              ◼
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={!input.trim() || (!apiKey && !session)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-white transition-colors disabled:opacity-30"
              style={{ background: "var(--accent)" }}
              title="Send"
            >
              ↑
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
        AIsathi can make mistakes · तपाईंको AI साथी
      </p>
    </div>
  );

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      <div className="flex min-h-0 flex-1">
        {/* ---- Sidebar: conversations ---- */}
        <aside
          className="hidden w-64 flex-none flex-col md:flex"
          style={{ borderRight: "1px solid var(--border-hairline)", background: "#0d0d0d" }}
        >
          <div className="p-3">
            <button
              onClick={startNewChat}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/5"
              style={{ border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", color: "var(--text-strong)" }}
            >
              <span style={{ color: "var(--ev-red)" }}>+</span> New chat
            </button>
          </div>
          <div className="sathi-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            {chats.length === 0 && (
              <p className="px-2 pt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
                Your conversations live here — stored in your browser only.
              </p>
            )}
            {chats.map((c) => (
              <div
                key={c.id}
                className="group flex items-center gap-1 rounded-md transition-colors hover:bg-white/5"
                style={{ background: c.id === chatId ? "var(--ev-white-05)" : "transparent" }}
              >
                <button
                  onClick={() => { setChatId(c.id); setError(""); }}
                  className="min-w-0 flex-1 px-3 py-2.5 text-left text-[13px]"
                  style={{ color: c.id === chatId ? "var(--text-strong)" : "var(--text-muted)" }}
                >
                  <span className="block truncate">{c.title || "New chat"}</span>
                </button>
                <button
                  onClick={() => deleteChat(c.id)}
                  className="flex-none px-2 opacity-0 transition-opacity group-hover:opacity-100"
                  style={{ color: "var(--text-faint)" }}
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <div className="p-4 text-xs" style={{ borderTop: "1px solid var(--border-hairline)", color: "var(--text-faint)" }}>
            {session ? (
              <>
                {fullName ?? session.user.email}
                {balance !== null && <span className="float-right font-semibold" style={{ color: "var(--text-muted)" }}>रू {balance}</span>}
              </>
            ) : (
              <a href="/login" className="font-semibold no-underline" style={{ color: "var(--ev-red)" }}>Sign in →</a>
            )}
          </div>
        </aside>

        {/* ---- Chat area ---- */}
        <main className="flex min-w-0 flex-1 flex-col">
          {messages.length === 0 ? (
            /* Empty state: greeting + centered composer, Claude-style */
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              <div className="w-full max-w-2xl text-center">
                <div className="font-[family-name:var(--font-script)] text-2xl" style={{ color: "var(--ev-red)" }}>
                  {g.np} 🙏
                </div>
                <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-normal tracking-tight sm:text-5xl">
                  {g.en}
                </h1>
                <div className="mt-8 text-left">{composer}</div>
                <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.text}
                      onClick={() => send(s.text)}
                      disabled={!apiKey && !session}
                      className="flex items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors hover:bg-white/5 disabled:opacity-40"
                      style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", color: "var(--text-body)" }}
                    >
                      <span className="text-lg">{s.icon}</span> {s.text}
                    </button>
                  ))}
                </div>
                {!session && !apiKey && (
                  <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
                    <a href="/login" className="font-semibold no-underline" style={{ color: "var(--ev-red)" }}>Sign in free</a>
                    {" "}— chat with free models instantly, no setup.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Conversation */}
              <div className="sathi-scroll min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl px-6 py-8">
                  <div className="space-y-8">
                    {messages.map((m, i) =>
                      m.role === "user" ? (
                        <div key={i} className="flex justify-end">
                          <div
                            className="max-w-[80%] px-4 py-3 text-[15px] leading-relaxed"
                            style={{ background: "var(--ev-white-05)", border: "1px solid var(--border-hairline)", borderRadius: "16px 16px 4px 16px" }}
                          >
                            <Content text={m.content} />
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="flex gap-3.5">
                          <div
                            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white"
                            style={{ background: "var(--accent)" }}
                          >
                            AI
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="text-[15px] leading-relaxed">
                              <Content text={m.content} />
                              {busy && i === messages.length - 1 && (
                                <span className="ml-1 inline-block h-4 w-2 animate-pulse align-text-bottom" style={{ background: "var(--text-muted)" }} />
                              )}
                            </div>
                            {m.costNpr != null && (
                              <div className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
                                {m.costNpr === 0 ? "free · रू0" : `रू ${m.costNpr}`} · {model.split("/").pop()}
                              </div>
                            )}
                          </div>
                        </div>
                      ),
                    )}
                    {waiting && (
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--accent)" }}>
                          AI
                        </div>
                        <span className="text-sm italic" style={{ color: "var(--text-faint)" }}>साथी सोच्दै छ…</span>
                      </div>
                    )}
                  </div>
                  <div ref={endRef} />
                </div>
              </div>
              {/* Bottom composer */}
              <div className="px-6 pb-4 pt-2">
                <div className="mx-auto w-full max-w-3xl">{composer}</div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
