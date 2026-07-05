"use client";

/**
 * Playground: a ChatGPT-style chat that talks to our own public gateway
 * exactly like an external developer would — same endpoint, same key auth.
 * Free models (रू0/M) work even with an empty balance; paid models meter
 * per message. If the playground works, the API works.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";

type Msg = { role: "user" | "assistant"; content: string; costNpr?: number | null };
type CatalogModel = {
  id: string;
  pricing?: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

const SUGGESTIONS = [
  "नेपालको बारेमा एउटा कविता लेख्नुहोस्",
  "Explain APIs like I'm five",
  "Write a Python function to reverse a string",
  "What should I see in Kathmandu in one day?",
];

function isFree(m: CatalogModel) {
  return (
    !!m.pricing && m.pricing.prompt_npr_per_m === 0 && m.pricing.completion_npr_per_m === 0
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
            className="my-2 overflow-x-auto rounded-lg bg-black/60 p-3 font-[family-name:var(--font-mono)] text-xs leading-relaxed text-zinc-200"
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
  const [editingKey, setEditingKey] = useState(false);
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("nepalai_key") ?? "";
    setApiKey(saved);
    setEditingKey(!saved);
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((j) => setModels(j.data ?? []))
      .catch(() => {});
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
  }

  function stop() {
    abortRef.current?.abort();
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy || !apiKey) return;
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
      setMessages([...next, { role: "assistant", content: "" }]);
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
      if ((e as Error).name === "AbortError") {
        setMessages((cur) => cur); // keep whatever streamed before stop
      } else {
        setError(String(e));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  const freeModels = models.filter(isFree);
  const paidModels = models.filter((m) => !isFree(m)).slice(0, 200);
  const currentIsFree = models.length > 0 && freeModels.some((m) => m.id === model);

  return (
    <div className="flex h-screen flex-col bg-zinc-950 text-zinc-100">
      <Nav />

      {/* Toolbar: model + key + balance */}
      <div className="border-b border-zinc-800/60 px-4 py-2.5">
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="max-w-[60vw] rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm outline-none focus:border-zinc-600"
          >
            {freeModels.length > 0 && (
              <optgroup label="🆓 Free — works without credits">
                {freeModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="⚡ Paid — metered per message">
              {[...(models.length === 0 ? [{ id: model }] : []), ...paidModels].map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </optgroup>
          </select>
          {currentIsFree && (
            <span className="rounded-full bg-green-900/40 px-2.5 py-1 text-xs text-green-400">free</span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {balance !== null && (
              <span className="rounded-full border border-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                रू {balance}
              </span>
            )}
            {editingKey ? (
              <input
                autoFocus
                value={apiKey}
                onChange={(e) => saveKey(e.target.value)}
                onBlur={() => apiKey && setEditingKey(false)}
                onKeyDown={(e) => e.key === "Enter" && apiKey && setEditingKey(false)}
                placeholder="np-… API key"
                className="w-52 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs outline-none focus:border-red-500"
              />
            ) : (
              <button
                onClick={() => setEditingKey(true)}
                className="rounded-full border border-zinc-800 px-2.5 py-1 font-[family-name:var(--font-mono)] text-xs text-zinc-400 hover:border-zinc-600"
                title="change API key"
              >
                🔑 {apiKey.slice(0, 10)}…
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Conversation */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-4 py-6">
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-16 text-center">
              <div className="text-5xl">🙏</div>
              <h1 className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold">
                नमस्ते! के सोध्न मन छ?
              </h1>
              <p className="mt-2 text-sm text-zinc-500">
                {apiKey
                  ? "Pick a model above — free models cost nothing, paid ones meter per message."
                  : "Paste your np-… API key above to begin. Get one on your "}
                {!apiKey && (
                  <a href="/account" className="text-red-400 hover:text-red-300">account page</a>
                )}
              </p>
              <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={!apiKey}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-left text-sm text-zinc-300 transition hover:border-zinc-600 disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-6">
            {messages.map((m, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className={
                    "flex h-8 w-8 flex-none items-center justify-center rounded-full text-sm font-bold " +
                    (m.role === "user" ? "bg-zinc-700" : "bg-red-600")
                  }
                >
                  {m.role === "user" ? "तपाईं"[0] : "S"}
                </div>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="text-sm leading-relaxed text-zinc-100">
                    <Content text={m.content} />
                    {busy && i === messages.length - 1 && m.role === "assistant" && (
                      <span className="ml-1 inline-block h-4 w-2 animate-pulse bg-zinc-400 align-text-bottom" />
                    )}
                  </div>
                  {m.role === "assistant" && m.costNpr != null && (
                    <div className="mt-1.5 text-xs text-zinc-600">
                      {m.costNpr === 0 ? "free · रू0" : `रू ${m.costNpr}`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div ref={endRef} />
        </div>
      </main>

      {/* Composer */}
      <div className="border-t border-zinc-800/60 px-4 py-3">
        <div className="mx-auto w-full max-w-3xl">
          {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
          <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 focus-within:border-zinc-600">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={apiKey ? "Message SathiAI…  (Shift+Enter for a new line)" : "Add your API key above first"}
              disabled={!apiKey}
              className="max-h-40 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-zinc-600 disabled:opacity-50"
            />
            {busy ? (
              <button
                onClick={stop}
                className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium hover:border-zinc-500"
              >
                ◼ Stop
              </button>
            ) : (
              <button
                onClick={() => send()}
                disabled={!apiKey || !input.trim()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-40"
              >
                ↑
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-600">
            <span>
              {messages.length > 0 && (
                <button onClick={() => setMessages([])} className="hover:text-zinc-400">
                  + New chat
                </button>
              )}
            </span>
            <span>SathiAI can make mistakes · तपाईंको AI साथी</span>
          </div>
        </div>
      </div>
    </div>
  );
}
