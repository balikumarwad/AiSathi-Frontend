"use client";

/**
 * Playground — Claude-style chat with AIsathi personality, sharpened:
 *  - sidebar chat history (browser-stored), rename (dblclick), delete, export
 *  - markdown rendering (headings/bold/lists/links/inline+fenced code)
 *  - image attach (multimodal vision through the same gateway)
 *  - copy reply, regenerate last answer, per-chat total cost
 *  - streaming, per-message रू cost, free tier, auto-key for signed-in users
 */

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Nav from "@/components/Nav";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

type Msg = { role: "user" | "assistant"; content: string; images?: string[]; costNpr?: number | null; model?: string };
type Chat = { id: string; title: string; messages: Msg[]; updated: number };
type CatalogModel = {
  id: string;
  name?: string;
  vision?: boolean;
  pricing?: { prompt_npr_per_m: number; completion_npr_per_m: number };
};

/**
 * Every playground request carries this system prompt so all 340 models
 * behave consistently: clear English by default, Nepali only when the user
 * chooses it, tidy markdown.
 */
const SYSTEM_PROMPT =
  "You are AIsathi, a friendly AI assistant from Nepal (aisathi.io). " +
  "Always respond in clear, simple English by default — even if the question mixes languages. " +
  "Only respond in Nepali if the user writes fully in Nepali or explicitly asks for Nepali. " +
  "Be helpful and direct. Use markdown: headings for structure, bullet lists for steps, code blocks for code. " +
  "Keep answers focused — thorough when needed, never padded.";

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

/* ---------------- markdown-lite renderer (no deps, no raw HTML) ---------------- */

function Inline({ text }: { text: string }) {
  // tokens: `code`, **bold**, *italic*, [label](url)
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (p.startsWith("`") && p.endsWith("`"))
          return (
            <code key={i} className="rounded px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[0.85em]" style={{ background: "rgba(255,255,255,0.08)" }}>
              {p.slice(1, -1)}
            </code>
          );
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        const link = p.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (link)
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="underline decoration-1 underline-offset-2" style={{ color: "var(--ev-red)" }}>
              {link[1]}
            </a>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.length > 0);
        if (lines.length === 0) return null;
        // heading
        const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
        if (h && lines.length === 1) {
          const size = ["text-xl font-bold", "text-lg font-bold", "text-base font-bold", "text-[15px] font-semibold"][h[1].length - 1];
          return <div key={bi} className={`mb-2 mt-4 ${size}`}><Inline text={h[2]} /></div>;
        }
        // list block
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={bi} className="my-2 space-y-1.5 pl-1">
              {lines.map((l, li) => {
                const numbered = l.match(/^\s*(\d+)[.)]\s+(.*)$/);
                const bullet = l.match(/^\s*[-*•]\s+(.*)$/);
                return (
                  <li key={li} className="flex gap-2.5">
                    <span className="flex-none pt-px text-sm" style={{ color: "var(--ev-red)" }}>
                      {numbered ? `${numbered[1]}.` : "•"}
                    </span>
                    <span><Inline text={numbered ? numbered[2] : bullet![1]} /></span>
                  </li>
                );
              })}
            </ul>
          );
        }
        // paragraph (preserve single newlines)
        return (
          <p key={bi} className="my-2 first:mt-0 last:mb-0">
            {lines.map((l, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                <Inline text={l} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const lang = code.match(/^([a-z0-9+-]+)\n/i)?.[1] ?? "";
  const body = code.replace(/^[a-z0-9+-]*\n/i, "");
  return (
    <div className="group/code relative my-3">
      <div className="flex items-center justify-between rounded-t-md px-4 py-1.5 text-[11px]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-faint)" }}>
        <span className="font-[family-name:var(--font-mono)]">{lang || "code"}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="font-semibold transition-colors hover:text-white"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-md p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid var(--border-hairline)", borderTop: "none" }}>
        {body}
      </pre>
    </div>
  );
}

function Content({ text }: { text: string }) {
  const parts = text.split("```");
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <CodeBlock key={i} code={part} /> : part.trim() ? <Prose key={i} text={part} /> : null,
      )}
    </>
  );
}

/* ---------------- model picker (opens upward, inside composer) ---------------- */

function ModelPicker({ models, model, onPick }: { models: CatalogModel[]; model: string; onPick: (id: string) => void }) {
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
  const match = (m: CatalogModel) => !ql || m.id.toLowerCase().includes(ql) || (m.name ?? "").toLowerCase().includes(ql);
  const AUTO: CatalogModel = { id: "openrouter/auto", name: "✨ Auto — picks the best AI for your question" };
  const free = models.filter(isFree).filter(match).filter((m) => m.id !== AUTO.id);
  const paid = models.filter((m) => !isFree(m)).filter(match).filter((m) => m.id !== AUTO.id);

  const groupLabel = {
    padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
    textTransform: "uppercase" as const, color: "var(--text-faint)",
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
          {m.name ?? m.id} {m.vision && <span title="Understands images">📷</span>}
        </span>
        <span className="block truncate font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--text-faint)" }}>{m.id}</span>
      </span>
      <span className="flex-none text-xs font-semibold" style={{ color: isFree(m) ? "#4ade80" : "var(--text-muted)" }}>{fmtPrice(m)}</span>
    </button>
  );

  const shortName = model.split("/").pop() ?? model;
  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex max-w-[40vw] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 sm:max-w-xs"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border-hairline)" }}
        title={model}
      >
        <span className="truncate">{shortName}</span>
        <span style={{ color: "var(--text-faint)" }}>▾</span>
      </button>
      {open && (
        <div className="absolute bottom-full z-30 mb-2 w-[420px] max-w-[85vw] overflow-hidden" style={{ background: "#131313", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}>
          <input
            autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${models.length} models…`}
            className="w-full px-4 py-3 text-sm outline-none"
            style={{ background: "transparent", borderBottom: "1px solid var(--border-hairline)", color: "var(--text-strong)" }}
          />
          <div className="sathi-scroll max-h-72 overflow-y-auto pb-1">
            {match(AUTO) && (
              <>
                <div style={groupLabel}>Recommended</div>
                {row(AUTO)}
              </>
            )}
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

/* ---------------- page ---------------- */

const newChatId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export default function Playground() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("openai/gpt-4o-mini");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState<string>("");
  const [input, setInput] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [usage, setUsage] = useState<{ pct: number; left: number } | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(0); // highest tier dismissed
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const chat = chats.find((c) => c.id === chatId) ?? null;
  const messages = chat?.messages ?? [];
  const chatCost = messages.reduce((s, m) => s + (m.costNpr ?? 0), 0);

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

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let cancelled = false;
    sb.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setBannerDismissed(Number(localStorage.getItem("aisathi_usage_dismissed") ?? 0));
      // Credits-used banner (Claude-style): % of everything ever topped up.
      if (data.session) {
        fetch("/api/account/usage", { headers: { Authorization: `Bearer ${data.session.access_token}` } })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            if (!j || cancelled) return;
            const total = Number(j.total_spent_npr) + Number(j.balance_npr);
            if (total > 0) setUsage({ pct: Math.round((j.total_spent_npr / total) * 100), left: j.balance_npr });
          })
          .catch(() => {});
      }
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

  /* ---- chat ops ---- */
  function startNewChat() {
    setChatId("");
    setError("");
    setImages([]);
    setSidebarOpen(false);
    inputRef.current?.focus();
  }

  function deleteChat(id: string) {
    const next = chats.filter((c) => c.id !== id);
    persist(next);
    if (chatId === id) setChatId(next[0]?.id ?? "");
  }

  function renameChat(id: string) {
    const c = chats.find((x) => x.id === id);
    const title = prompt("Rename chat:", c?.title ?? "");
    if (title?.trim()) persist(chats.map((x) => (x.id === id ? { ...x, title: title.trim().slice(0, 60) } : x)));
  }

  function exportChat() {
    if (!chat) return;
    const md = [
      `# ${chat.title}`,
      `_Exported from AIsathi (aisathi.io) · total cost रू${chatCost.toFixed(4)}_`,
      "",
      ...chat.messages.map((m) => `**${m.role === "user" ? "You" : `AIsathi (${m.model ?? "model"})`}:**\n\n${m.content}\n`),
    ].join("\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${chat.title.slice(0, 30).replace(/[^\w\s-]/g, "").trim() || "chat"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function updateChat(id: string, msgs: Msg[], all: Chat[]): Chat[] {
    return all
      .map((c) => (c.id === id ? { ...c, messages: msgs, updated: Date.now() } : c))
      .sort((a, b) => b.updated - a.updated);
  }

  /* ---- voice input (browser speech recognition; Chrome/Edge) ---- */
  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    type SpeechRec = {
      lang: string; continuous: boolean; interimResults: boolean;
      onresult: (e: { resultIndex: number; results: { [i: number]: { isFinal: boolean; 0: { transcript: string } }; length: number } }) => void;
      onend: () => void; onerror: () => void; start: () => void; stop: () => void;
    };
    const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRec; SpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice input needs Chrome or Edge.");
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text) setInput((cur) => (cur ? cur + " " : "") + text.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  /* ---- slash commands ---- */
  const slashOpen = input.startsWith("/") && !input.includes("\n");
  const slashQuery = slashOpen ? input.slice(1).toLowerCase() : "";
  type Cmd = { cmd: string; hint: string; run: () => void };
  const bestFreeCmd = models.find((m) => isFree(m) && m.vision) ?? models.find(isFree);
  const COMMANDS: Cmd[] = [
    { cmd: "new", hint: "Start a new chat", run: () => { setInput(""); startNewChat(); } },
    ...(bestFreeCmd ? [{ cmd: "free", hint: `Switch to a free model (${bestFreeCmd.id.split("/").pop()})`, run: () => { setModel(bestFreeCmd.id); setInput(""); } }] : []),
    { cmd: "auto", hint: "Switch to ✨ Auto — best model per question", run: () => { setModel("openrouter/auto"); setInput(""); } },
    { cmd: "model ", hint: "Switch model by name — e.g. /model claude", run: () => {} },
    ...(chat ? [{ cmd: "export", hint: "Download this chat as Markdown", run: () => { setInput(""); exportChat(); } }] : []),
  ];
  const slashMatches = COMMANDS.filter((c) => c.cmd.trim().startsWith(slashQuery.split(" ")[0]));
  function runSlash(raw?: string) {
    const text = (raw ?? input).slice(1).trim();
    const [word, ...rest] = text.split(/\s+/);
    if (word === "model" && rest.length) {
      const q = rest.join(" ").toLowerCase();
      const found = models.find((m) => m.id.toLowerCase().includes(q) || (m.name ?? "").toLowerCase().includes(q));
      if (found) { setModel(found.id); setInput(""); }
      else setError(`No model matches "${rest.join(" ")}"`);
      return true;
    }
    const hit = COMMANDS.find((c) => c.cmd.trim() === word);
    if (hit && hit.cmd !== "model ") { hit.run(); return true; }
    return false;
  }

  /* ---- global "/" focuses the composer ---- */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (e.key === "/" && t.tagName !== "TEXTAREA" && t.tagName !== "INPUT" && !t.isContentEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function attachImages(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files).slice(0, 3 - images.length)) {
      if (!f.type.startsWith("image/") || f.size > 4 * 1024 * 1024) {
        setError("Images only, max 4MB each.");
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => setImages((cur) => [...cur, String(reader.result)].slice(0, 3));
      reader.readAsDataURL(f);
    }
  }

  /* ---- send / stream / regenerate ---- */
  async function run(history: Msg[], id: string, all: Chat[]) {
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const apiMessages: unknown[] = [{ role: "system", content: SYSTEM_PROMPT }];
      history.forEach((m) => apiMessages.push(
        m.images?.length
          ? {
              role: m.role,
              content: [
                { type: "text", text: m.content },
                ...m.images.map((url) => ({ type: "image_url", image_url: { url } })),
              ],
            }
          : { role: m.role, content: m.content },
      ));
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        // max_tokens caps the reply so expensive models can't run away and
        // upstream credit reservations stay small. ~3000 words is plenty for chat.
        body: JSON.stringify({ model, messages: apiMessages, stream: true, max_tokens: 4096 }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => null);
        const msg = json?.error?.message ?? `Error ${res.status}`;
        setError(/image|vision|multimodal/i.test(String(msg)) ? `${msg} — tip: pick a vision-capable model (e.g. gpt-4o-mini, gemini).` : msg);
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
              all = updateChat(id, [...history, { role: "assistant", content: reply, model }], all);
              setChats(all);
            }
          } catch { /* partial line */ }
        }
      }
      persist(updateChat(id, [...history, { role: "assistant", content: reply || "(empty reply)", costNpr: cost, model }], all));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if ((!content && images.length === 0) || busy) return;
    if (!apiKey.trim()) {
      setError(session ? "Setting up your account key — try again in a second." : "Sign in to start chatting.");
      return;
    }
    setError("");
    setInput("");
    const imgs = images;
    setImages([]);
    if (inputRef.current) inputRef.current.style.height = "auto";

    let id = chatId;
    let all = chats;
    if (!chat) {
      id = newChatId();
      all = [{ id, title: (content || "Image chat").slice(0, 42), messages: [], updated: Date.now() }, ...chats];
      setChatId(id);
    }
    const base = all.find((c) => c.id === id)!.messages;
    const next: Msg[] = [...base, { role: "user", content: content || "What is in this image?", images: imgs.length ? imgs : undefined }];
    all = updateChat(id, next, all);
    persist(all);
    await run(next, id, all);
  }

  async function regenerate() {
    if (!chat || busy) return;
    const msgs = [...chat.messages];
    while (msgs.length && msgs[msgs.length - 1].role === "assistant") msgs.pop();
    if (!msgs.length) return;
    setError("");
    const all = updateChat(chat.id, msgs, chats);
    persist(all);
    await run(msgs, chat.id, all);
  }

  function copyMessage(i: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  const fullName =
    (session?.user.user_metadata?.full_name as string | undefined) ??
    (session?.user.user_metadata?.name as string | undefined);
  const firstName = fullName?.trim().split(/\s+/)[0];
  const g = greeting(firstName);
  const waiting = busy && messages.length > 0 && messages[messages.length - 1].role === "user";

  // Usage banner tiers: 50% (heads-up, amber) / 80% (urgent, red). Dismissing
  // hides the current tier; crossing the next tier brings it back.
  const tier = usage ? (usage.pct >= 80 ? 80 : usage.pct >= 50 ? 50 : 0) : 0;
  const showBanner = tier > 0 && bannerDismissed < tier;
  function dismissBanner() {
    setBannerDismissed(tier);
    localStorage.setItem("aisathi_usage_dismissed", String(tier));
  }
  const usageBanner = showBanner && usage && (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
      style={{
        background: tier >= 80 ? "var(--ev-red-15)" : "rgba(217, 160, 50, 0.12)",
        borderBottom: `1px solid ${tier >= 80 ? "var(--border-accent)" : "rgba(217, 160, 50, 0.35)"}`,
        color: "var(--text-body)",
      }}
    >
      <span className="min-w-0 flex-1 truncate">
        You&apos;ve used <strong>{usage.pct}%</strong> of your credits · रू{usage.left} left
      </span>
      <a href="/dashboard" className="flex-none font-semibold underline underline-offset-2" style={{ color: "var(--text-strong)" }}>
        View usage
      </a>
      <a href="/topup" className="flex-none rounded-full px-3 py-1 text-xs font-bold text-white no-underline" style={{ background: "var(--accent)" }}>
        Top up
      </a>
      <button onClick={dismissBanner} className="flex-none px-1" style={{ color: "var(--text-faint)" }} title="Dismiss">
        ×
      </button>
    </div>
  );

  const currentModel = models.find((m) => m.id === model);
  const visionMismatch = images.length > 0 && currentModel && !currentModel.vision;
  const bestVision = models.find((m) => m.id === "openai/gpt-4o-mini" && m.vision) ?? models.find((m) => m.vision);
  const bestFree = models.find((m) => isFree(m) && m.vision) ?? models.find(isFree);
  const outOfCredits = /insufficient credits/i.test(error);

  const composer = (
    <div className="w-full">
      {error && outOfCredits ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-3 p-3.5 text-[13px]"
          style={{ background: "var(--ev-red-15)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-md)" }}
        >
          <span className="min-w-0 flex-1">
            <strong>Out of credits</strong> — this model charges per message. Chat free instead, or top up to unlock every model.
          </span>
          {bestFree && (
            <button
              onClick={() => { setModel(bestFree.id); setError(""); }}
              className="flex-none rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}
            >
              🆓 Use a free model
            </button>
          )}
          <a
            href="/topup"
            className="flex-none rounded-full px-4 py-1.5 text-xs font-bold text-white no-underline"
            style={{ background: "var(--accent)" }}
          >
            Top up →
          </a>
        </div>
      ) : error ? (
        <p className="mb-2 text-xs" style={{ color: "var(--ev-red)" }}>{error}</p>
      ) : null}
      {visionMismatch && (
        <div
          className="mb-2 flex flex-wrap items-center gap-3 p-3 text-[13px]"
          style={{ background: "rgba(250, 204, 21, 0.08)", border: "1px solid rgba(250, 204, 21, 0.3)", borderRadius: "var(--radius-md)", color: "var(--text-body)" }}
        >
          <span className="min-w-0 flex-1">📷 <strong>{model.split("/").pop()}</strong> can&apos;t see images.</span>
          {bestVision && (
            <button
              onClick={() => setModel(bestVision.id)}
              className="flex-none rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}
            >
              Switch to {bestVision.id.split("/").pop()} 📷
            </button>
          )}
        </div>
      )}
      <div className="relative flex flex-col gap-2 p-3" style={{ background: "#141414", border: "1px solid var(--border-strong)", borderRadius: 16, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        {slashOpen && slashMatches.length > 0 && (
          <div className="absolute bottom-full left-3 z-30 mb-2 w-80 max-w-[85vw] overflow-hidden" style={{ background: "#131313", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-md)", boxShadow: "0 16px 48px rgba(0,0,0,0.7)" }}>
            {slashMatches.map((c) => (
              <button
                key={c.cmd}
                onClick={() => { if (c.cmd === "model ") setInput("/model "); else c.run(); inputRef.current?.focus(); }}
                className="flex w-full items-baseline gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
              >
                <span className="font-[family-name:var(--font-mono)] text-sm font-semibold" style={{ color: "var(--ev-red)" }}>/{c.cmd.trim()}</span>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>{c.hint}</span>
              </button>
            ))}
          </div>
        )}
        {images.length > 0 && (
          <div className="flex gap-2 px-1">
            {images.map((src, i) => (
              <div key={i} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="attachment" className="h-14 w-14 rounded-lg object-cover" style={{ border: "1px solid var(--border-strong)" }} />
                <button
                  onClick={() => setImages(images.filter((_, x) => x !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: "var(--accent)" }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
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
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (input.startsWith("/") && runSlash()) return;
              send();
            }
            if (e.key === "Escape") (e.target as HTMLTextAreaElement).blur();
          }}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData?.items ?? []).filter((x) => x.type.startsWith("image/"));
            if (items.length) {
              e.preventDefault();
              const dt = new DataTransfer();
              items.forEach((x) => { const f = x.getAsFile(); if (f) dt.items.add(f); });
              attachImages(dt.files);
            }
          }}
          placeholder={apiKey ? "Ask your साथी anything…  ( / for commands )" : "Sign in to start chatting…"}
          disabled={!apiKey && !session}
          className="max-h-44 w-full resize-none bg-transparent px-2 pt-1 text-[15px] outline-none placeholder:text-zinc-600"
          style={{ color: "var(--text-strong)" }}
        />
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { attachImages(e.target.files); e.target.value = ""; }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 3}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-white/5 disabled:opacity-30"
            style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}
            title="Attach image (or paste one)"
          >
            📎
          </button>
          <button
            onClick={toggleMic}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-white/5"
            style={{
              border: `1px solid ${listening ? "var(--ev-red)" : "var(--border-hairline)"}`,
              color: listening ? "var(--ev-red)" : "var(--text-muted)",
              background: listening ? "var(--ev-red-15)" : "transparent",
            }}
            title={listening ? "Stop dictating" : "Dictate with your voice"}
          >
            {listening ? "⏺" : "🎤"}
          </button>
          <ModelPicker models={models} model={model} onPick={setModel} />
          {balance !== null && (
            balance < 10 ? (
              <a href="/topup" className="hidden text-xs font-semibold no-underline sm:inline" style={{ color: "var(--ev-red)" }} title="Balance is low — top up">
                रू {balance} · top up
              </a>
            ) : (
              <span className="hidden text-xs sm:inline" style={{ color: "var(--text-faint)" }}>रू {balance}</span>
            )
          )}
          <div className="flex-1" />
          {busy ? (
            <button onClick={() => abortRef.current?.abort()} className="flex h-9 w-9 items-center justify-center rounded-xl text-sm" style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }} title="Stop">
              ◼
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={(!input.trim() && images.length === 0) || (!apiKey && !session)}
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

  const sidebar = (
    <>
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
            Your conversations live here — stored in your browser only. Double-click to rename.
          </p>
        )}
        {chats.map((c) => (
          <div key={c.id} className="group flex items-center gap-1 rounded-md transition-colors hover:bg-white/5" style={{ background: c.id === chatId ? "var(--ev-white-05)" : "transparent" }}>
            <button
              onClick={() => { setChatId(c.id); setError(""); setSidebarOpen(false); }}
              onDoubleClick={() => renameChat(c.id)}
              className="min-w-0 flex-1 px-3 py-2.5 text-left text-[13px]"
              style={{ color: c.id === chatId ? "var(--text-strong)" : "var(--text-muted)" }}
              title="Double-click to rename"
            >
              <span className="block truncate">{c.title || "New chat"}</span>
            </button>
            <button onClick={() => deleteChat(c.id)} className="flex-none px-2 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--text-faint)" }} title="Delete chat">
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
    </>
  );

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 flex-none flex-col md:flex" style={{ borderRight: "1px solid var(--border-hairline)", background: "#0d0d0d" }}>
          {sidebar}
        </aside>
        {/* Mobile drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
            <aside className="absolute bottom-0 left-0 top-0 flex w-72 flex-col" style={{ background: "#0d0d0d", borderRight: "1px solid var(--border-strong)" }}>
              {sidebar}
            </aside>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          {usageBanner}
          {/* Chat header (only when a conversation is open) */}
          {messages.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid var(--border-hairline)" }}>
              <button onClick={() => setSidebarOpen(true)} className="rounded-md px-2 py-1 text-sm md:hidden" style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}>
                ☰
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-medium" onDoubleClick={() => chat && renameChat(chat.id)} title="Double-click to rename">
                {chat?.title}
              </span>
              {chatCost > 0 && (
                <span className="hidden text-[11px] sm:inline" style={{ color: "var(--text-faint)" }}>
                  this chat: रू{chatCost.toFixed(4)}
                </span>
              )}
              <button onClick={exportChat} className="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/5" style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }} title="Download this chat as Markdown">
                ⬇ Export
              </button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              <div className="w-full max-w-2xl text-center">
                {chats.length > 0 && (
                  <button onClick={() => setSidebarOpen(true)} className="mb-6 rounded-md px-3 py-1.5 text-xs md:hidden" style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}>
                    ☰ Chat history
                  </button>
                )}
                <div className="font-[family-name:var(--font-script)] text-2xl" style={{ color: "var(--ev-red)" }}>{g.np} 🙏</div>
                <h1 className="mt-1 font-[family-name:var(--font-display)] text-4xl font-normal tracking-tight sm:text-5xl">{g.en}</h1>
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
              <div className="sathi-scroll min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-3xl px-6 py-8">
                  <div className="space-y-8">
                    {messages.map((m, i) =>
                      m.role === "user" ? (
                        <div key={i} className="flex flex-col items-end gap-2">
                          {m.images?.map((src, xi) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img key={xi} src={src} alt="sent" className="max-h-48 max-w-[60%] rounded-xl object-contain" style={{ border: "1px solid var(--border-strong)" }} />
                          ))}
                          <div className="max-w-[80%] px-4 py-3 text-[15px] leading-relaxed" style={{ background: "var(--ev-white-05)", border: "1px solid var(--border-hairline)", borderRadius: "16px 16px 4px 16px" }}>
                            <Content text={m.content} />
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="group flex gap-3.5">
                          <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--accent)" }}>
                            AI
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <div className="text-[15px] leading-relaxed">
                              <Content text={m.content} />
                              {busy && i === messages.length - 1 && (
                                <span className="ml-1 inline-block h-4 w-2 animate-pulse align-text-bottom" style={{ background: "var(--text-muted)" }} />
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
                              {m.costNpr != null && <span>{m.costNpr === 0 ? "free · रू0" : `रू ${m.costNpr}`} · {(m.model ?? model).split("/").pop()}</span>}
                              {!busy && (
                                <span className="flex gap-3 opacity-0 transition-opacity group-hover:opacity-100">
                                  <button onClick={() => copyMessage(i, m.content)} className="font-semibold hover:text-white">
                                    {copiedIdx === i ? "✓ copied" : "copy"}
                                  </button>
                                  {i === messages.length - 1 && (
                                    <button onClick={regenerate} className="font-semibold hover:text-white">↻ regenerate</button>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                    {waiting && (
                      <div className="flex items-center gap-3.5">
                        <div className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: "var(--accent)" }}>AI</div>
                        <span className="text-sm italic" style={{ color: "var(--text-faint)" }}>साथी सोच्दै छ…</span>
                      </div>
                    )}
                  </div>
                  <div ref={endRef} />
                </div>
              </div>
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
