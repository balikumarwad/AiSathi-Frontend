"use client";

/**
 * Playground: calls our own public gateway exactly like an external developer
 * would — same endpoint, same key auth. If the playground works, the API works.
 */

import { useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";

type Msg = { role: "user" | "assistant"; content: string };

export default function Playground() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [models, setModels] = useState<string[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastCost, setLastCost] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setApiKey(localStorage.getItem("nepalai_key") ?? "");
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((j) => setModels((j.data ?? []).map((m: { id: string }) => m.id)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function saveKey(k: string) {
    setApiKey(k);
    localStorage.setItem("nepalai_key", k);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError("");
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ model, messages: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message ?? `Error ${res.status}`);
      } else {
        const reply = json.choices?.[0]?.message?.content ?? "(empty reply)";
        setMessages([...next, { role: "assistant", content: reply }]);
        setLastCost(json.nepalai?.cost_npr ?? null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <Nav />
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-6">
        <div className="flex flex-wrap gap-3">
          <input
            value={apiKey}
            onChange={(e) => saveKey(e.target.value)}
            placeholder="np-… API key (stored in your browser)"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-zinc-600"
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm outline-none"
          >
            {[model, ...models.filter((m) => m !== model)].slice(0, 200).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
          {messages.length === 0 && (
            <p className="text-sm text-zinc-500">
              Paste your API key, pick a model, and say नमस्ते 👋
            </p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
              <div
                className={
                  "inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2 text-sm " +
                  (m.role === "user" ? "bg-red-600/90" : "bg-zinc-800")
                }
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <p className="text-sm text-zinc-500">thinking…</p>}
          <div ref={endRef} />
        </div>

        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        {lastCost !== null && (
          <p className="mt-2 text-xs text-zinc-500">last message cost: रू {lastCost}</p>
        )}

        <div className="mt-3 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message…"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm outline-none focus:border-zinc-600"
          />
          <button
            onClick={send}
            disabled={busy || !apiKey}
            className="rounded-lg bg-red-600 px-5 py-2.5 text-sm font-medium hover:bg-red-500 disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </main>
    </div>
  );
}
