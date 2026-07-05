"use client";

/**
 * Playground — implements the AIsathi design (design/SathiAI.dc.html):
 * two-column controls (API key + model) with uppercase micro-labels, dark
 * chat canvas with hairline border, red user bubbles / inset assistant
 * bubbles, "साथी is typing…", square red Send. Calls our own public gateway
 * exactly like an external developer would; free models work with रू0.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Msg = { role: "user" | "assistant"; content: string; costNpr?: number | null };
type CatalogModel = {
  id: string;
  name?: string;
  pricing?: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

function isFree(m: CatalogModel) {
  return (
    !!m.pricing && m.pricing.prompt_npr_per_m === 0 && m.pricing.completion_npr_per_m === 0
  );
}

const microLabel = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  color: "var(--text-muted)",
  marginBottom: 6,
};

const fieldStyle = {
  width: "100%",
  padding: "12px 14px",
  background: "var(--surface-inset)",
  color: "var(--text-strong)",
  fontSize: 14,
  borderRadius: "var(--radius-xs)",
  border: "1px solid var(--border-strong)",
  outline: "none",
} as const;

function fmtPrice(m: CatalogModel) {
  if (!m.pricing) return "";
  if (isFree(m)) return "Free";
  return `रू${m.pricing.prompt_npr_per_m} / रू${m.pricing.completion_npr_per_m}`;
}

/** OpenRouter-style model picker: click to open, type to filter, pick a row. */
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
        <span className="block truncate text-sm" style={{ color: "var(--text-strong)" }}>
          {m.name ?? m.id}
        </span>
        <span className="block truncate font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--text-faint)" }}>
          {m.id}
        </span>
      </span>
      <span className="flex-none text-xs font-semibold" style={{ color: isFree(m) ? "#4ade80" : "var(--text-muted)" }}>
        {fmtPrice(m)}
      </span>
    </button>
  );

  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 text-left"
        style={fieldStyle}
      >
        <span className="truncate">{model}</span>
        <span className="flex-none text-xs" style={{ color: "var(--text-faint)" }}>▼</span>
      </button>
      {open && (
        <div
          className="absolute z-30 mt-1 w-full min-w-[320px] overflow-hidden"
          style={{
            background: "#111",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-sm)",
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
          <div className="sathi-scroll max-h-80 overflow-y-auto pb-1">
            {free.length > 0 && <div style={groupLabel}>🆓 Free — works without credits</div>}
            {free.slice(0, 30).map(row)}
            {paid.length > 0 && <div style={groupLabel}>⚡ Paid — रू in / out per 1M tokens</div>}
            {paid.slice(0, 80).map(row)}
            {free.length + paid.length === 0 && (
              <div className="px-4 py-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
                No models match &quot;{q}&quot;
              </div>
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
            className="my-2 overflow-x-auto p-3 font-[family-name:var(--font-mono)] text-xs leading-relaxed"
            style={{
              background: "rgba(0,0,0,0.5)",
              borderRadius: "var(--radius-xs)",
              border: "1px solid var(--border-hairline)",
            }}
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

export default function Playground() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("nepalai_key") ?? "");
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((j) => setModels(j.data ?? []))
      .catch(() => {});
  }, []);

  // Signed-in users chat with zero setup: if they have no key in this
  // browser, quietly mint one from their session — same self-serve endpoint
  // the account page uses. Developers can still paste any key manually.
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`,
        },
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

  useEffect(() => {
    refreshBalance(apiKey);
  }, [apiKey, refreshBalance]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function saveKey(k: string) {
    setApiKey(k);
    localStorage.setItem("nepalai_key", k);
    setError("");
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function send() {
    const content = input.trim();
    if (!content || busy) return;
    if (!apiKey.trim()) {
      setError(session ? "Setting up your account key — try again in a second." : "Sign in or add an API key above before sending a message.");
      return;
    }
    setError("");
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
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
        setMessages(next);
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
              setMessages([...next, { role: "assistant", content: reply }]);
            }
          } catch {
            /* partial line */
          }
        }
      }
      setMessages([
        ...next,
        { role: "assistant", content: reply || "(empty reply)", costNpr: cost },
      ]);
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
  const waitingForFirstToken =
    busy && messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col px-6 py-7">
        {/* Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div>
            {session ? (
              <>
                <label style={microLabel}>Account</label>
                <div className="flex items-center justify-between" style={{ ...fieldStyle, padding: "12px 14px" }}>
                  <span className="truncate text-sm" style={{ color: "var(--text-body)" }}>
                    {fullName ?? session.user.email}
                  </span>
                  <span className="ml-3 flex-none text-sm font-semibold">
                    {balance !== null ? `रू ${balance}` : "…"}
                  </span>
                </div>
                <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                  Free models cost nothing —{" "}
                  <a href="/topup" className="font-semibold no-underline" style={{ color: "var(--ev-red)" }}>
                    top up
                  </a>{" "}
                  to unlock Claude, GPT &amp; more. Developer?{" "}
                  <a href="/account" className="no-underline" style={{ color: "var(--text-muted)" }}>
                    API keys →
                  </a>
                </p>
              </>
            ) : apiKey ? (
              <>
                <label style={microLabel}>AIsathi API key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => saveKey(e.target.value)}
                  placeholder="np-..."
                  style={fieldStyle}
                />
                <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                  Stored only in your browser.
                </p>
              </>
            ) : (
              <>
                <label style={microLabel}>Start chatting</label>
                <div className="flex items-center gap-3">
                  <a
                    href="/login"
                    className="flex-none px-6 py-3 text-[13px] font-bold text-white no-underline"
                    style={{ background: "var(--accent)", borderRadius: "var(--radius-pill)" }}
                  >
                    Sign in — it&apos;s free
                  </a>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => saveKey(e.target.value)}
                    placeholder="or paste an API key (np-...)"
                    style={{ ...fieldStyle, flex: 1 }}
                  />
                </div>
                <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
                  Sign in and chat instantly — free models included, no setup needed.
                </p>
              </>
            )}
          </div>
          <div>
            <label style={microLabel}>Model</label>
            <ModelPicker models={models} model={model} onPick={setModel} />
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
              See prices on the{" "}
              <a href="/models" className="font-semibold no-underline" style={{ color: "var(--ev-red)" }}>Models page</a>
              {balance !== null && <> · balance <span style={{ color: "var(--text-body)" }}>रू {balance}</span></>}
            </p>
          </div>
        </div>

        {/* Chat canvas */}
        <div
          className="sathi-scroll my-3.5 flex min-h-[420px] flex-1 flex-col gap-3.5 overflow-y-auto p-6"
          style={{
            maxHeight: "55vh",
            background: "var(--ev-ink, #050505)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          {messages.length === 0 && (
            <div className="m-auto max-w-[380px] text-center">
              <div className="mb-2 text-[17px] font-semibold">
                {firstName ? `नमस्ते, ${firstName}! 🙏` : "Say नमस्ते"}
              </div>
              <p className="m-0 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {apiKey
                  ? "Pick a model above and type your message below. Free models cost nothing — paid ones show रू per message."
                  : "Sign in (or paste an API key) above, then type your message below to start chatting."}
              </p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className="flex flex-col" style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <div
                className="max-w-[72%] px-[15px] py-2.5 text-sm leading-normal"
                style={
                  m.role === "user"
                    ? { background: "var(--accent)", color: "var(--ev-white)", borderRadius: "var(--radius-sm)" }
                    : {
                        background: "var(--ev-white-05)",
                        color: "var(--text-strong)",
                        border: "1px solid var(--border-hairline)",
                        borderRadius: "var(--radius-sm)",
                      }
                }
              >
                <Content text={m.content} />
              </div>
              {m.role === "assistant" && m.costNpr != null && (
                <div className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                  {m.costNpr === 0 ? "free · रू0" : `रू ${m.costNpr}`}
                </div>
              )}
            </div>
          ))}
          {waitingForFirstToken && (
            <div className="self-start text-[13px] italic" style={{ color: "var(--text-faint)" }}>
              साथी is typing…
            </div>
          )}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        {error && (
          <p className="mb-2 mt-0 text-xs" style={{ color: "var(--ev-red)" }}>{error}</p>
        )}
        <div className="flex gap-2.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message…"
            style={{ ...fieldStyle, padding: "14px 16px", flex: 1 }}
          />
          {busy ? (
            <button
              onClick={stop}
              className="px-7 py-3.5 text-sm font-bold"
              style={{
                background: "transparent",
                color: "var(--text-strong)",
                border: "1px solid var(--border-strong)",
                borderRadius: "var(--radius-xs)",
              }}
            >
              Stop
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-7 py-3.5 text-sm font-bold text-white transition-colors"
              style={{
                background: input.trim() ? "var(--accent)" : "var(--ev-white-10)",
                color: input.trim() ? "var(--ev-white)" : "var(--text-faint)",
                border: "none",
                borderRadius: "var(--radius-xs)",
                cursor: input.trim() ? "pointer" : "not-allowed",
              }}
            >
              Send
            </button>
          )}
        </div>
      </main>

      <footer
        className="p-6 text-center text-xs"
        style={{ color: "var(--text-faint)", borderTop: "1px solid var(--border-hairline)" }}
      >
        AIsathi · तपाईंको AI साथी · aisathi.io
      </footer>
    </div>
  );
}
