"use client";

/**
 * Playground — implements the AIsathi design (design/SathiAI.dc.html):
 * two-column controls (API key + model) with uppercase micro-labels, dark
 * chat canvas with hairline border, red user bubbles / inset assistant
 * bubbles, "साथी is typing…", square red Send. Calls our own public gateway
 * exactly like an external developer would; free models work with रू0.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";

type Msg = { role: "user" | "assistant"; content: string; costNpr?: number | null };
type CatalogModel = {
  id: string;
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
      setError("Add your API key above before sending a message.");
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

  const freeModels = models.filter(isFree);
  const paidModels = models.filter((m) => !isFree(m)).slice(0, 200);
  const waitingForFirstToken =
    busy && messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      <main className="mx-auto flex w-full max-w-[900px] flex-1 flex-col px-6 py-7">
        {/* Controls */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1.4fr_1fr]">
          <div>
            <label style={microLabel}>AIsathi API key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => saveKey(e.target.value)}
              placeholder="np-..."
              style={fieldStyle}
            />
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
              Stored only in your browser. Don&apos;t have one?{" "}
              <a href="/account" className="font-semibold no-underline" style={{ color: "var(--ev-red)" }}>
                Create a key ↗
              </a>
            </p>
          </div>
          <div>
            <label style={microLabel}>Model</label>
            <select value={model} onChange={(e) => setModel(e.target.value)} style={fieldStyle}>
              {freeModels.length > 0 && (
                <optgroup label="Free — works without credits">
                  {freeModels.map((m) => (
                    <option key={m.id} value={m.id}>{m.id}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Paid — metered per message">
                {[...(models.length === 0 ? [{ id: model }] : []), ...paidModels].map((m) => (
                  <option key={m.id} value={m.id}>{m.id}</option>
                ))}
              </optgroup>
            </select>
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
              <div className="mb-2 text-[17px] font-semibold">Say नमस्ते</div>
              <p className="m-0 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                Add your API key and pick a model above, then type your message below to start
                chatting. Free models cost nothing — paid ones show रू per message.
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
