"use client";

/**
 * Playground — Claude-style chat with AIsathi personality, sharpened:
 *  - sidebar chat history (browser-stored), rename (dblclick), delete, export
 *  - markdown rendering (headings/bold/lists/links/inline+fenced code)
 *  - image attach (multimodal vision through the same gateway)
 *  - copy reply, regenerate last answer, per-chat total cost
 *  - streaming, per-message रू cost, free tier, auto-key for signed-in users
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Nav from "@/components/Nav";
import Content from "@/components/Markdown";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { mergeChats, publishChat, pullChats, pushChat, removeChat } from "@/lib/chatSync";
import { addMemory, deleteMemory, loadMemories, type Memory } from "@/lib/memory";

type DocRef = { name: string; pages: number };
type Msg = { role: "user" | "assistant"; content: string; images?: string[]; costNpr?: number | null; model?: string; doc?: boolean; attachments?: DocRef[]; docText?: string };
type Chat = { id: string; title: string; messages: Msg[]; updated: number };
type CatalogModel = {
  id: string;
  name?: string;
  vision?: boolean;
  image_out?: boolean;
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
  { icon: "🎨", text: "Create an image of a rhino galloping past Everest at sunrise" },
  { icon: "📄", text: "Write a professional cover letter for a software engineer job" },
  { icon: "🧳", text: "Plan a perfect 3-day trip to Pokhara on a budget" },
];

// Text-first prompts for the anonymous demo (free models, no image/doc tools).
const DEMO_SUGGESTIONS = [
  { icon: "🏔️", text: "Write a short poem about the Himalayas in Nepali" },
  { icon: "💡", text: "Explain how AI works, using a momo-making analogy" },
  { icon: "🌐", text: "Translate 'Where is the nearest bus stop?' into Nepali" },
  { icon: "🧳", text: "Plan a perfect 3-day trip to Pokhara on a budget" },
];

/**
 * Creator router — the playground's lightweight agentic layer. Every message
 * is classified by intent and dispatched to the right specialist pipeline:
 * image → an image-output model (modalities:["image","text"]), doc → a
 * document-writer prompt on the Smart tier with PDF export, video → honest
 * "not yet" (no upstream video models exist), everything else → normal chat.
 */
function detectIntent(text: string): "image" | "video" | "doc" | "chat" {
  const t = text.toLowerCase();
  const wantsMake = /\b(make|create|generate|design|draft|prepare|produce|write|banau\w*)\b/.test(t);
  if (wantsMake && /\b(video|animation|reel|clip|short film)\b/.test(t)) return "video";
  if ((wantsMake && /\b(image|photo|picture|logo|poster|banner|wallpaper|illustration|thumbnail|tasbir)\b/.test(t)) || /\b(draw|sketch)\b/.test(t)) return "image";
  if (wantsMake && /\b(pdf|document|report|letter|resume|cv|cover letter|essay|proposal|invoice|contract|application|biodata|memo|notice|agreement)\b/.test(t)) return "doc";
  return "chat";
}

// Runs quietly after each signed-in turn on a free model to capture durable
// facts about the user (ChatGPT-style memory). Output is parsed as JSON.
const MEMORY_EXTRACT_PROMPT =
  "You extract durable, long-term facts about the USER that are worth remembering across future chats — their name, location, job or role, languages, stable preferences, and ongoing projects. " +
  "Ignore anything transient, hypothetical, or specific to the current task. Write each fact as a short third-person statement (e.g. \"Lives in Pokhara\", \"Prefers replies in Nepali\"). " +
  "Return ONLY a JSON array of at most 3 strings. If there is nothing worth remembering, return [].";

const DOC_PROMPT =
  "You are AIsathi's professional document writer. Produce the COMPLETE document the user asked for in clean, well-structured markdown: " +
  "a clear title heading, organized sections, and professional wording. Output ONLY the document itself — no commentary before or after. " +
  "If key details are missing (names, dates, addresses), use sensible placeholders like [Your Name].";

/* ---- markdown → print-ready HTML (for the PDF download of doc messages) ---- */

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) =>
    s.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>");
  let html = "";
  md.split("```").forEach((seg, i) => {
    if (i % 2 === 1) {
      html += `<pre><code>${esc(seg.replace(/^\w+\n/, ""))}</code></pre>`;
      return;
    }
    for (const para of seg.split(/\n{2,}/)) {
      const lines = para.split("\n").filter(Boolean);
      if (!lines.length) continue;
      const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
      if (h && lines.length === 1) {
        html += `<h${h[1].length}>${inline(esc(h[2]))}</h${h[1].length}>`;
        continue;
      }
      if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
        html += "<ul>" + lines.map((l) => `<li>${inline(esc(l.replace(/^\s*([-*•]|\d+[.)])\s+/, "")))}</li>`).join("") + "</ul>";
        continue;
      }
      html += `<p>${lines.map((l) => inline(esc(l))).join("<br/>")}</p>`;
    }
  });
  return html;
}

function downloadPdf(title: string, md: string) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title.replace(/</g, "")}</title><style>
    body{font-family:Georgia,'Times New Roman',serif;max-width:720px;margin:48px auto;padding:0 32px;color:#111;line-height:1.65;}
    h1{font-size:26px;border-bottom:2px solid #e11d2e;padding-bottom:8px;}h2{font-size:20px;margin-top:28px;}h3{font-size:17px;}
    pre{background:#f4f4f4;padding:14px;border-radius:6px;overflow-x:auto;font-size:13px;}code{font-family:Consolas,monospace;}
    ul{padding-left:22px;}li{margin:4px 0;}
    footer{margin-top:48px;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:10px;}
  </style></head><body>${mdToHtml(md)}<footer>Created with AIsathi — aisathi.io</footer></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

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

/* ---------------- model picker (opens upward, inside composer) ---------------- */

/**
 * Tier presets (handbook §3 Level 3): casual users pick by feel, not from
 * 340 raw model names. Mappings live here so the underlying model can be
 * swapped without users noticing — margin management by indirection.
 */
const TIERS = [
  { tier: "⚡ Fast", desc: "Quick everyday answers — cheapest", id: "google/gemini-3.1-flash-lite" },
  { tier: "🧠 Smart", desc: "Best balance — Claude Sonnet", id: "anthropic/claude-sonnet-5" },
  { tier: "🚀 Genius", desc: "Frontier intelligence — Claude Fable", id: "anthropic/claude-fable-5" },
];

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
          {m.name ?? m.id} {m.vision && <span title="Understands images">📷</span>} {m.image_out && <span title="Generates images">🎨</span>}
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
            {!ql && (
              <>
                <div style={groupLabel}>Choose by feel</div>
                {TIERS.map((t) => {
                  const m = models.find((x) => x.id === t.id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => { onPick(t.id); setOpen(false); setQ(""); }}
                      className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                      style={{ background: t.id === model ? "var(--ev-red-15)" : "transparent" }}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{t.tier}</span>
                        <span className="block truncate text-[11px]" style={{ color: "var(--text-faint)" }}>{t.desc}</span>
                      </span>
                      {m && <span className="flex-none text-xs font-semibold" style={{ color: "var(--text-muted)" }}>{fmtPrice(m)}</span>}
                    </button>
                  );
                })}
              </>
            )}
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

// Signed-out visitors get this many free messages before we ask them to sign
// up — the "try before you buy" front door. Server enforces free-models-only
// plus an IP cap; this client counter is the honest-path UX.
const DEMO_CAP = 5;

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
  const [shared, setShared] = useState<"idle" | "sharing" | "copied">("idle");
  const [listening, setListening] = useState(false);
  const [demoUsed, setDemoUsed] = useState(0); // signed-out free-message counter
  const [docs, setDocs] = useState<{ name: string; text: string; pages: number }[]>([]); // pending PDF attachments
  const [docBusy, setDocBusy] = useState(false); // reading a PDF
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryToast, setMemoryToast] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const memoriesRef = useRef<Memory[]>([]);
  const recRef = useRef<{ stop: () => void } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Cross-device sync (signed-in users): refs avoid stale closures in persist.
  const sessionRef = useRef<Session | null>(null);
  const chatsRef = useRef<Chat[]>([]);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const chat = chats.find((c) => c.id === chatId) ?? null;
  const messages = chat?.messages ?? [];
  const chatCost = messages.reduce((s, m) => s + (m.costNpr ?? 0), 0);

  // Demo mode: signed out AND no pasted key. Free-model, capped, no billing.
  const demoMode = !session && !apiKey.trim();
  const demoLeft = Math.max(0, DEMO_CAP - demoUsed);

  /** Ordered free models to try for the anonymous demo lane. The free pool is
   *  heavily rate-limited, so run() falls through this list until one responds.
   *  Leads with models that reliably return normal (non-reasoning) content. */
  function demoModels(): string[] {
    const frees = models.filter(isFree);
    const byPref = (re: RegExp) => frees.filter((m) => re.test(m.id)).map((m) => m.id);
    const ordered = [
      ...byPref(/gpt-oss-120b/i),
      ...byPref(/llama-3\.3-70b/i),
      ...byPref(/gemma-4/i),
      ...byPref(/llama/i),
      "openrouter/free",
      ...frees.map((m) => m.id),
    ];
    const uniq = [...new Set(ordered)].slice(0, 5);
    return uniq.length ? uniq : [model];
  }

  useEffect(() => {
    setApiKey(localStorage.getItem("nepalai_key") ?? "");
    setDemoUsed(Number(localStorage.getItem("aisathi_demo_used") ?? 0));
    try {
      const saved = JSON.parse(localStorage.getItem("aisathi_chats") ?? "[]") as Chat[];
      setChats(saved);
      chatsRef.current = saved;
      if (saved[0]) setChatId(saved[0].id);
    } catch { /* fresh start */ }
    fetch("/api/v1/models")
      .then((r) => r.json())
      .then((j) => setModels(j.data ?? []))
      .catch(() => {});
  }, []);

  const persist = useCallback((next: Chat[]) => {
    setChats(next);
    chatsRef.current = next;
    try { localStorage.setItem("aisathi_chats", JSON.stringify(next.slice(0, 30))); } catch { /* full */ }
    // Debounced server sync of the most recently touched chat.
    const s = sessionRef.current;
    const sb = supabaseBrowser();
    if (!s || !sb || next.length === 0) return;
    const newest = next.reduce((a, b) => (a.updated > b.updated ? a : b));
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => {
      pushChat(sb, s.user.id, newest).catch(() => { /* offline is fine, local copy stays */ });
    }, 1200);
  }, []);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    let cancelled = false;
    sb.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      sessionRef.current = data.session;
      setBannerDismissed(Number(localStorage.getItem("aisathi_usage_dismissed") ?? 0));
      // Pull server chats and merge with local (newest per id wins), then
      // backfill any local-only/newer chats upward — history follows the
      // account across devices, like ChatGPT/Claude.
      if (data.session) {
        const uid = data.session.user.id;
        pullChats(sb)
          .then((remote) => {
            if (cancelled) return;
            const local = chatsRef.current;
            const merged = mergeChats(local, remote);
            const remoteStamp = new Map(remote.map((r) => [r.id, r.updated]));
            local
              .filter((c) => c.messages.length > 0 && (c.updated > (remoteStamp.get(c.id) ?? 0)))
              .slice(0, 20)
              .forEach((c) => pushChat(sb, uid, c).catch(() => {}));
            setChats(merged);
            chatsRef.current = merged;
            try { localStorage.setItem("aisathi_chats", JSON.stringify(merged.slice(0, 30))); } catch { /* full */ }
            setChatId((cur) => cur || (merged[0]?.id ?? ""));
          })
          .catch(() => {});
      }
      // Load persistent memory so it can be injected into the system prompt.
      if (data.session) {
        loadMemories(sb).then((m) => { if (!cancelled) { setMemories(m); memoriesRef.current = m; } }).catch(() => {});
      }
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
  useEffect(() => { memoriesRef.current = memories; }, [memories]);

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
    const sb = supabaseBrowser();
    if (sb && sessionRef.current) removeChat(sb, id).catch(() => {});
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

  /** Publish the current chat and copy a public read-only link. Signed-in only. */
  async function shareChat() {
    if (!chat || !session || shared === "sharing") return;
    const sb = supabaseBrowser();
    if (!sb) return;
    setShared("sharing");
    try {
      const slug = await publishChat(sb, session.user.id, { id: chat.id, title: chat.title, messages: chat.messages, updated: chat.updated });
      await navigator.clipboard.writeText(`${location.origin}/share/${slug}`);
      setShared("copied");
      setTimeout(() => setShared("idle"), 2200);
    } catch {
      setShared("idle");
      setError("Couldn't create a share link — please try again.");
    }
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

  async function attachFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const isImg = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
      if (isImg) {
        if (f.size > 4 * 1024 * 1024) { setError("Images max 4MB each."); continue; }
        const reader = new FileReader();
        reader.onload = () => setImages((cur) => [...cur, String(reader.result)].slice(0, 3));
        reader.readAsDataURL(f);
      } else if (isPdf) {
        if (f.size > 20 * 1024 * 1024) { setError("PDFs max 20MB."); continue; }
        setError("");
        setDocBusy(true);
        try {
          const { extractPdfText } = await import("@/lib/pdf");
          const { text, pages } = await extractPdfText(f);
          if (!text) setError(`"${f.name}" has no selectable text — it may be a scanned image.`);
          setDocs((cur) => [...cur, { name: f.name, text, pages }].slice(0, 3));
        } catch {
          setError(`Couldn't read "${f.name}".`);
        } finally {
          setDocBusy(false);
        }
      } else {
        setError("Attach images or PDFs only.");
      }
    }
  }

  /** Quietly capture durable facts about the user after a turn (ChatGPT-style
   *  memory). Runs on a FREE model so it never costs the user anything; any
   *  failure (e.g. free pool busy) is silently skipped. */
  async function extractMemory(userText: string) {
    if (!session || !apiKey || userText.trim().length < 12) return;
    const sb = supabaseBrowser();
    if (!sb) return;
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            { role: "system", content: MEMORY_EXTRACT_PROMPT },
            { role: "user", content: userText.slice(0, 2000) },
          ],
          max_tokens: 150,
        }),
      });
      if (!res.ok) return;
      const j = await res.json();
      const raw: string = j.choices?.[0]?.message?.content ?? "[]";
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return;
      const facts: unknown = JSON.parse(match[0]);
      if (!Array.isArray(facts)) return;
      const existing = new Set(memoriesRef.current.map((m) => m.content.toLowerCase()));
      const fresh = (facts as unknown[])
        .filter((f): f is string => typeof f === "string" && f.trim().length > 2 && f.length < 160)
        .map((f) => f.trim())
        .filter((f) => !existing.has(f.toLowerCase()))
        .slice(0, 3);
      if (!fresh.length) return;
      const added: Memory[] = [];
      for (const f of fresh) {
        const m = await addMemory(sb, session.user.id, f);
        if (m) added.push(m);
      }
      if (added.length) {
        setMemories((cur) => [...cur, ...added]);
        setMemoryToast(true);
        setTimeout(() => setMemoryToast(false), 2800);
      }
    } catch { /* best-effort */ }
  }

  /** System prompt for normal chat, with the user's persistent memory injected. */
  function systemWithMemory(): string {
    const mem = memoriesRef.current;
    if (!mem.length) return SYSTEM_PROMPT;
    return (
      SYSTEM_PROMPT +
      "\n\nThings you remember about this user (use naturally when relevant; do not recite them back):\n" +
      mem.map((m) => `- ${m.content}`).join("\n")
    );
  }

  /* ---- send / stream / regenerate ---- */
  async function run(history: Msg[], id: string, all: Chat[], opts?: { model?: string; system?: string; doc?: boolean; key?: string; fallbacks?: string[] }) {
    const useKey = opts?.key ?? apiKey;
    const candidates = [opts?.model ?? model, ...(opts?.fallbacks ?? [])];
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const apiMessages: unknown[] = [{ role: "system", content: opts?.system ?? systemWithMemory() }];
      history.forEach((m) => {
        // Attached-document text rides along as context on the user turn so the
        // model can read and answer about the PDF.
        const textContent = m.docText ? `${m.docText}\n\n${m.content}` : m.content;
        apiMessages.push(
          m.images?.length
            ? {
                role: m.role,
                content: [
                  { type: "text", text: textContent },
                  ...m.images.map((url) => ({ type: "image_url", image_url: { url } })),
                ],
              }
            : { role: m.role, content: textContent },
        );
      });
      // Try each candidate model until one returns an OK stream. The failure
      // (e.g. a free model rate-limited upstream) happens before any tokens
      // stream, so the fallback is invisible to the user.
      let res: Response | null = null;
      let useModel = candidates[0];
      let lastJson: { error?: { message?: string } } | null = null;
      for (let i = 0; i < candidates.length; i++) {
        useModel = candidates[i];
        res = await fetch("/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${useKey}` },
          // max_tokens caps the reply so expensive models can't run away and
          // upstream credit reservations stay small. ~3000 words is plenty.
          body: JSON.stringify({ model: useModel, messages: apiMessages, stream: true, max_tokens: 4096 }),
          signal: ac.signal,
        });
        if (res.ok && res.body) break;
        lastJson = await res.json().catch(() => null);
        res = null; // try next candidate
      }
      if (!res || !res.body) {
        const msg = lastJson?.error?.message ?? "The model is busy right now — please try again.";
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
              all = updateChat(id, [...history, { role: "assistant", content: reply, model: useModel }], all);
              setChats(all);
            }
          } catch { /* partial line */ }
        }
      }
      persist(updateChat(id, [...history, { role: "assistant", content: reply || "(empty reply)", costNpr: cost, model: useModel, doc: opts?.doc }], all));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  /** Image agent: non-streaming request to an image-output model; returned
   *  images render in the reply and download on click. Attached images pass
   *  through too, so "make this photo into a logo" edits work. */
  async function runImage(history: Msg[], id: string, all: Chat[]) {
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const imgModel =
        models.find((m) => m.id === "google/gemini-3.1-flash-image")?.id ??
        models.find((m) => m.image_out && !/preview|lite/.test(m.id) && m.id !== "openrouter/auto")?.id ??
        models.find((m) => m.image_out && m.id !== "openrouter/auto")?.id;
      if (!imgModel) {
        setError("No image-generation model is available right now.");
        return;
      }
      const ctx = history.slice(-6).map((m) =>
        m.images?.length
          ? { role: m.role, content: [{ type: "text", text: m.content }, ...m.images.map((url) => ({ type: "image_url", image_url: { url } }))] }
          : { role: m.role, content: m.content },
      );
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: imgModel, messages: ctx, modalities: ["image", "text"], max_tokens: 4096 }),
        signal: ac.signal,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(json?.error?.message ?? `Error ${res.status}`);
        return;
      }
      const reply = json?.choices?.[0]?.message;
      const outImgs: string[] = (reply?.images ?? [])
        .map((im: { image_url?: { url?: string } }) => im?.image_url?.url)
        .filter(Boolean);
      if (json?.nepalai?.balance_npr != null) setBalance(json.nepalai.balance_npr);
      persist(updateChat(id, [...history, {
        role: "assistant",
        content: reply?.content || (outImgs.length ? "Here you go! 🎨 Click the image to download." : "The model returned no image — try describing it differently."),
        images: outImgs.length ? outImgs : undefined,
        costNpr: json?.nepalai?.cost_npr ?? null,
        model: imgModel,
      }], all));
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(String(e));
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function docModel() {
    const smart = "anthropic/claude-sonnet-5";
    return (balance ?? 0) > 5 && models.some((m) => m.id === smart) ? smart : model;
  }

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if ((!content && images.length === 0 && docs.length === 0) || busy || docBusy) return;

    // Signed-out visitor: run the free demo lane until the cap, then invite signup.
    if (demoMode) {
      if (demoLeft <= 0) { setError("__DEMO_LIMIT__"); return; }
      if (images.length || docs.length) { setError("Sign up free to chat with images and PDFs — the demo is text-only."); return; }
    } else if (!apiKey.trim()) {
      setError("Setting up your account — try again in a second.");
      return;
    }

    setError("");
    setInput("");
    const imgs = images;
    setImages([]);
    const attached = docs;
    setDocs([]);
    if (inputRef.current) inputRef.current.style.height = "auto";

    const docText = attached.length
      ? attached.map((d) => `--- Attached document: ${d.name} (${d.pages} pages) ---\n${d.text}`).join("\n\n")
      : undefined;
    const defaultPrompt = attached.length
      ? `Summarize ${attached.map((d) => d.name).join(", ")}.`
      : "What is in this image?";
    const titleSeed = content || (attached.length ? attached[0].name : "Image chat");

    let id = chatId;
    let all = chats;
    if (!chat) {
      id = newChatId();
      all = [{ id, title: titleSeed.slice(0, 42), messages: [], updated: Date.now() }, ...chats];
      setChatId(id);
    }
    const base = all.find((c) => c.id === id)!.messages;
    const next: Msg[] = [...base, {
      role: "user",
      content: content || defaultPrompt,
      images: imgs.length ? imgs : undefined,
      attachments: attached.length ? attached.map((d) => ({ name: d.name, pages: d.pages })) : undefined,
      docText,
    }];
    all = updateChat(id, next, all);
    persist(all);

    // Capture durable facts in the background (signed-in, non-demo). Free model.
    if (session && content) void extractMemory(content);

    // Demo lane: force a free model, skip the creator router (images/docs need
    // credits), and count the message toward the cap.
    if (demoMode) {
      const used = Number(localStorage.getItem("aisathi_demo_used") ?? 0) + 1;
      localStorage.setItem("aisathi_demo_used", String(used));
      setDemoUsed(used);
      const cands = demoModels();
      await run(next, id, all, { key: "demo", model: cands[0], fallbacks: cands.slice(1) });
      return;
    }

    // Creator router: dispatch to the specialist pipeline for this intent.
    const intent = content ? detectIntent(content) : "chat";
    if (intent === "video") {
      persist(updateChat(id, [...next, {
        role: "assistant",
        content:
          "🎬 Video generation isn't available on AIsathi yet — none of the model providers we route to offer video output through the gateway today. It's on the roadmap!\n\nMeanwhile I can create an **image** of this — just say *\"make an image of ...\"* 🎨",
        model: "aisathi/router",
      }], all));
      return;
    }
    if (intent === "image") {
      await runImage(next, id, all);
      return;
    }
    if (intent === "doc") {
      await run(next, id, all, { model: docModel(), system: DOC_PROMPT, doc: true });
      return;
    }
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
      {error === "__DEMO_LIMIT__" ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-3 p-3.5 text-[13px]"
          style={{ background: "var(--ev-red-15)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-md)" }}
        >
          <span className="min-w-0 flex-1">
            <strong>That&apos;s your {DEMO_CAP} free messages 🎉</strong> — sign up free to keep chatting. Unlimited free models, no card needed.
          </span>
          <a href="/login" className="flex-none rounded-full px-4 py-1.5 text-xs font-bold text-white no-underline" style={{ background: "var(--accent)" }}>
            Sign up free →
          </a>
        </div>
      ) : error && outOfCredits ? (
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
      ) : demoMode ? (
        <div
          className="mb-2 flex flex-wrap items-center gap-3 px-3.5 py-2 text-[13px]"
          style={{ background: "var(--surface-inset)", border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", color: "var(--text-body)" }}
        >
          <span className="min-w-0 flex-1">
            ✨ You&apos;re trying AIsathi free — <strong>{demoLeft}</strong> {demoLeft === 1 ? "message" : "messages"} left. Sign up for unlimited chats, images &amp; every model.
          </span>
          <a href="/login" className="flex-none font-semibold underline underline-offset-2" style={{ color: "var(--text-strong)" }}>
            Sign up free →
          </a>
        </div>
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
        {(docs.length > 0 || docBusy) && (
          <div className="flex flex-wrap gap-2 px-1">
            {docs.map((d, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: "var(--surface-inset)", border: "1px solid var(--border-hairline)" }}>
                <span aria-hidden>📄</span>
                <span className="max-w-[160px] truncate" style={{ color: "var(--text-body)" }}>{d.name}</span>
                <span style={{ color: "var(--text-faint)" }}>{d.pages}p</span>
                <button onClick={() => setDocs(docs.filter((_, x) => x !== i))} className="font-bold" style={{ color: "var(--text-faint)" }}>×</button>
              </div>
            ))}
            {docBusy && (
              <span className="flex items-center gap-2 px-2 py-1.5 text-xs italic" style={{ color: "var(--text-faint)" }}>
                <span className="thinking-shimmer">Reading PDF…</span>
              </span>
            )}
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
              attachFiles(dt.files);
            }
          }}
          placeholder={
            apiKey ? "Ask your साथी anything…  ( / for commands )"
            : demoMode ? `Ask anything — ${demoLeft} free ${demoLeft === 1 ? "message" : "messages"}, no sign-up…`
            : "Setting up your account…"
          }
          disabled={!apiKey && !session && demoLeft <= 0}
          className="max-h-44 w-full resize-none bg-transparent px-2 pt-1 text-[15px] outline-none placeholder:text-zinc-600"
          style={{ color: "var(--text-strong)" }}
        />
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" multiple hidden onChange={(e) => { attachFiles(e.target.files); e.target.value = ""; }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 3 && docs.length >= 3}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-white/5 disabled:opacity-30"
            style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}
            title="Attach image or PDF (or paste an image)"
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
      {session && (
        <button
          onClick={() => setMemoryOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/5"
          style={{ borderTop: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}
        >
          <span aria-hidden>🧠</span> Memory
          <span className="ml-auto" style={{ color: "var(--text-faint)" }}>{memories.length || ""}</span>
        </button>
      )}
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

  const memoryModal = memoryOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setMemoryOpen(false)}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl" style={{ background: "#141414", border: "1px solid var(--border-strong)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--border-hairline)" }}>
          <div className="flex items-center gap-2 font-semibold"><span aria-hidden>🧠</span> What AIsathi remembers</div>
          <button onClick={() => setMemoryOpen(false)} style={{ color: "var(--text-faint)" }}>✕</button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-3">
          {memories.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Nothing yet. As you chat, AIsathi remembers durable facts about you — your name, work, preferences — and uses them across all your conversations.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {memories.map((m) => (
                <li key={m.id} className="group flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--surface-inset)" }}>
                  <span className="min-w-0 flex-1" style={{ color: "var(--text-body)" }}>{m.content}</span>
                  <button
                    onClick={() => {
                      const sb = supabaseBrowser();
                      if (sb) deleteMemory(sb, m.id).catch(() => {});
                      setMemories((cur) => cur.filter((x) => x.id !== m.id));
                    }}
                    className="flex-none opacity-0 transition-opacity group-hover:opacity-100"
                    style={{ color: "var(--text-faint)" }}
                    title="Forget this"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-5 py-3 text-[11px]" style={{ borderTop: "1px solid var(--border-hairline)", color: "var(--text-faint)" }}>
          Memories are private to your account and injected into every chat. Delete any anytime.
        </div>
      </div>
    </div>
  );

  const memoryToastEl = memoryToast && (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg" style={{ background: "#141414", border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}>
      🧠 Memory updated
    </div>
  );

  return (
    <div className="flex h-screen flex-col" style={{ background: "var(--surface-page)", color: "var(--text-strong)" }}>
      <Nav />
      {memoryModal}
      {memoryToastEl}
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
              {session && (
                <button onClick={shareChat} disabled={shared === "sharing"} className="rounded-md px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/5" style={{ border: "1px solid var(--border-hairline)", color: shared === "copied" ? "var(--ev-red)" : "var(--text-muted)" }} title="Create a public link to this conversation">
                  {shared === "copied" ? "✓ Link copied" : shared === "sharing" ? "…" : "🔗 Share"}
                </button>
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
                  {(demoMode ? DEMO_SUGGESTIONS : SUGGESTIONS).map((s) => (
                    <button
                      key={s.text}
                      onClick={() => send(s.text)}
                      disabled={!apiKey && !session && demoLeft <= 0}
                      className="flex items-center gap-3 px-4 py-3 text-left text-[13px] transition-colors hover:bg-white/5 disabled:opacity-40"
                      style={{ border: "1px solid var(--border-hairline)", borderRadius: "var(--radius-md)", color: "var(--text-body)" }}
                    >
                      <span className="text-lg">{s.icon}</span> {s.text}
                    </button>
                  ))}
                </div>
                {demoMode && (
                  <p className="mt-6 text-sm" style={{ color: "var(--text-muted)" }}>
                    Just start typing — {DEMO_CAP} free messages, no sign-up. Or{" "}
                    <a href="/login" className="font-semibold no-underline" style={{ color: "var(--ev-red)" }}>sign up free</a>
                    {" "}for unlimited chats &amp; every model.
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
                          {m.attachments?.map((d, xi) => (
                            <div key={xi} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: "var(--surface-inset)", border: "1px solid var(--border-hairline)" }}>
                              <span aria-hidden>📄</span>
                              <span className="max-w-[200px] truncate" style={{ color: "var(--text-body)" }}>{d.name}</span>
                              <span style={{ color: "var(--text-faint)" }}>{d.pages}p</span>
                            </div>
                          ))}
                          <div className="max-w-[80%] px-4 py-3 text-[15px] leading-relaxed" style={{ background: "var(--ev-white-05)", border: "1px solid var(--border-hairline)", borderRadius: "16px 16px 4px 16px" }}>
                            <Content text={m.content} />
                          </div>
                        </div>
                      ) : (
                        <div key={i} className="group flex gap-3.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/icon.svg" alt="" className="h-7 w-7 flex-none rounded-full" />
                          <div className="min-w-0 flex-1 pt-0.5">
                            {m.images?.length ? (
                              <div className="mb-2 flex flex-wrap gap-2">
                                {m.images.map((src, xi) => (
                                  <a key={xi} href={src} download={`aisathi-${Date.now()}-${xi}.png`} title="Click to download">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={src} alt="generated" className="max-h-80 max-w-full rounded-xl object-contain transition-opacity hover:opacity-90" style={{ border: "1px solid var(--border-strong)" }} />
                                  </a>
                                ))}
                              </div>
                            ) : null}
                            <div className="text-[15px] leading-relaxed">
                              <Content text={m.content} />
                              {busy && i === messages.length - 1 && (
                                <span className="ml-1 inline-block h-4 w-2 animate-pulse align-text-bottom" style={{ background: "var(--text-muted)" }} />
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
                              {m.costNpr != null && <span>{m.costNpr === 0 ? "free · रू0" : `रू ${m.costNpr}`} · {(m.model ?? model).split("/").pop()}</span>}
                              {m.doc && !busy && (
                                <button
                                  onClick={() => downloadPdf(chat?.title ?? "document", m.content)}
                                  className="font-semibold"
                                  style={{ color: "var(--ev-red)" }}
                                >
                                  ⬇ Download PDF
                                </button>
                              )}
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
                      <div className="flex items-center gap-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/rhino-loader.svg" alt="" className="h-9 w-auto flex-none" />
                        <span className="thinking-shimmer text-sm font-medium">साथी सोच्दै छ…</span>
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
