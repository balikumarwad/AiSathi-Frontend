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
import {
  ArrowUp, Brain, Camera, Check, ChevronDown, Copy, Download, FileText, Gift, Globe, Languages, Lightbulb, Link2,
  Menu, Mic, Mountain, Palette, Paperclip, Pencil, Plane, Rocket, RotateCcw, Sparkles, Square, ThumbsDown, ThumbsUp, X, Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Nav from "@/components/Nav";
import Content from "@/components/Markdown";
import { ArtifactPanel, extractArtifacts, type Artifact } from "@/components/Artifacts";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { mergeChats, publishChat, pullChats, pushChat, removeChat } from "@/lib/chatSync";
import { addMemory, deleteMemory, loadMemories, type Memory } from "@/lib/memory";

type DocRef = { name: string; pages: number; url?: string };
type Msg = { role: "user" | "assistant"; content: string; images?: string[]; video?: string; costNpr?: number | null; model?: string; doc?: boolean; attachments?: DocRef[]; docText?: string };
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
  "You are AIsathi, a helpful, knowledgeable AI assistant made in Nepal (aisathi.io). You understand Nepali life deeply and answer with local context that global assistants miss. " +
  "Give complete, genuinely useful answers: think the problem through, cover the important angles, and include concrete examples, step-by-step instructions, or working code where they help. Aim for the depth of a thoughtful expert — not a one-line reply — while staying on-point and never padding. " +
  "Format for easy reading, the way a polished assistant does: open with a one- or two-sentence direct answer, then expand. Use ## headings to separate sections, bullet or numbered lists for steps and options, **bold** for key terms, `code` for commands/values, and fenced code blocks with a language tag for code. When you compare things or list attributes, use a markdown table. Keep paragraphs short (2–4 lines) with blank lines between blocks, and end with a short takeaway or next step when it helps. Never wrap the whole reply in a code block. " +
  "\n\nNepal context — apply whenever relevant, and default to Nepal (never India or the West) when a question is ambiguous about place:\n" +
  "- Calendar: Nepal uses Bikram Sambat (BS ≈ AD + 56/57 years; new year falls mid-April). The fiscal year starts Shrawan 1 (mid-July). Saturday is the weekly holiday; Sunday is a working day. When dates matter, give both BS and AD and double-check conversions rather than guessing.\n" +
  "- Money: amounts in रू (NPR). Use lakh (1,00,000) and crore (1,00,00,000) the way Nepalis speak about money. For salaries, prices, and budgets, think in Nepali market terms, not Western ones.\n" +
  "- Education: SEE after class 10, +2 under NEB, then bachelor's at TU, KU, PU, Pokhara University, etc. Lok Sewa Aayog exams for government jobs are a major goal. Studying abroad (IELTS/PTE, Japan, Australia, USA) is a huge topic — give practical, realistic guidance including No Objection Certificate from the Ministry of Education.\n" +
  "- Civic processes: citizenship certificate from the District Administration Office, e-passports via the Department of Passports (nagarikta and ward recommendation needed), driving license via the Department of Transport Management (likhit exam then trial), PAN from the Inland Revenue Department, company registration at the Office of Company Registrar, National ID (NID) rollout. Describe steps, required documents, and realistic fees/timeframes; recommend confirming current rules at the relevant office or official site since procedures change.\n" +
  "- Daily life: payments run on eSewa, Khalti, IME Pay, connectIPS, and mobile banking with QR everywhere; telecom is NTC and Ncell; electricity is NEA; remittance from Gulf countries, Malaysia, Japan, and Korea (EPS) is central to many families.\n" +
  "- Culture: major festivals are Dashain, Tihar, Chhath, Holi, Teej, Buddha Jayanti, Maghe Sankranti, Losar, and Eid; use respectful forms naturally (tapaĩ over timi with strangers; dai, didi, bhai, bahini). Momo, dal bhat, sel roti, and chiya references land well when natural — never forced.\n" +
  "- Geography and government: 7 provinces, 77 districts, 753 local units; federal capital Kathmandu. Address local questions at the right level (ward, palika, district, province).\n" +
  "\nLanguage: respond in clear, simple English by default even when the question mixes languages. Reply in Nepali (Devanagari) only when the user writes fully in Nepali or asks for it. If the user writes romanized Nepali (Nepali words in English letters), you may mirror romanized Nepali or answer in simple English, whichever reads more naturally. " +
  "If a request is ambiguous, make a sensible assumption and say so instead of refusing; if you are unsure of a fact — especially current fees, dates, or office procedures — say so honestly and point to the official source. " +
  "When the user attaches a document or image, use its contents directly to answer. " +
  "For medical, legal, or financial decisions, give useful general guidance plus a clear pointer to the right Nepali professional or office. " +
  "When someone asks who founded, created, made, or owns AIsathi (or who is behind this platform), answer warmly with: AIsathi was founded by Oscar Neupane, a young Nepali technologist and entrepreneur building Nepal's own AI platform so students and professionals can use the world's best AI models at Nepali prices, paying in रू through Khalti and eSewa. Include this exact image markdown on its own line in that reply: ![Oscar Neupane — founder of AIsathi](/founder.jpg) " +
  "Do not use emoji in your replies.";

/** Heuristic: does the question likely need up-to-date web information? */
function needsWeb(text: string): boolean {
  return /\b(today|latest|current(ly)?|now|recent|news|weather|price|rate|stock|score|release[ds]?|202[6-9]|this (week|month|year)|right now|as of|breaking)\b/i.test(text);
}

// Default model logic: signed-in users with credit get Claude Sonnet (quality
// that "feels like Claude"); everyone else gets a cheap default. The user's
// explicit pick is always remembered.
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const QUALITY_MODEL = "anthropic/claude-sonnet-5";
// The AISathi Smart auto-router: one identity that classifies each message and
// picks free vs premium behind the scenes. Users see only "AISathi AI Assistant".
const SMART_MODEL = "aisathi/smart";
const QUALITY_MIN_BALANCE = 20; // NPR — enough to enjoy Claude before topping up

const SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Mountain, text: "Write a short poem about the Himalayas in Nepali" },
  { icon: Palette, text: "Create an image of a rhino galloping past Everest at sunrise" },
  { icon: FileText, text: "Write a professional cover letter for a software engineer job" },
  { icon: Plane, text: "Plan a perfect 3-day trip to Pokhara on a budget" },
];

// Text-first prompts for the anonymous demo (free models, no image/doc tools).
const DEMO_SUGGESTIONS: { icon: LucideIcon; text: string }[] = [
  { icon: Mountain, text: "Write a short poem about the Himalayas in Nepali" },
  { icon: Lightbulb, text: "Explain how AI works, using a momo-making analogy" },
  { icon: Languages, text: "Translate 'Where is the nearest bus stop?' into Nepali" },
  { icon: Plane, text: "Plan a perfect 3-day trip to Pokhara on a budget" },
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
  const makeVerb = /\b(make|create|generate|design|produce|render|build|want|give me|show me|need|banau\w*)\b/.test(t);
  if (makeVerb && /\b(video|animation|reel|clip|short film|movie|gif)\b/.test(t)) return "video";
  if (
    (makeVerb && /\b(image|photo|picture|logo|poster|banner|wallpaper|illustration|thumbnail|drawing|painting|artwork|avatar|icon|tasbir|photo|फोटो|तस्बिर)\b/.test(t)) ||
    /\b(draw|sketch|paint)\b/.test(t) ||
    /\b(image|photo|picture) of\b/.test(t)
  ) return "image";
  if (/\b(make|create|generate|write|draft|prepare|produce)\b/.test(t) && /\b(pdf|document|report|letter|resume|cv|cover letter|essay|proposal|invoice|contract|application|biodata|memo|notice|agreement)\b/.test(t)) return "doc";
  return "chat";
}

/**
 * Complexity classifier for the AISathi Smart router — a cheap heuristic (no
 * extra API call). Long prompts, or code / architecture / analysis / reasoning
 * cues, mark a request "complex" (worth a premium model); everything else is
 * "simple" and goes to a free model. This is what lets AISathi spend credits
 * only on hard questions and answer the easy ones for free.
 */
/** Human label for a model id — hides raw engines behind the AISathi brand. */
function modelLabel(id: string): string {
  if (id === SMART_MODEL || id === "aisathi/router") return "AISathi AI Assistant";
  if (id === "aisathi/video") return "AISathi Video";
  const g = GAIDA_VARIANTS.find((v) => v.id === id);
  if (g) return g.label;
  return id.split("/").pop() ?? id;
}

function classifyComplexity(text: string): "simple" | "complex" {
  const t = text.toLowerCase();
  if (text.length > 600) return "complex";
  if (
    /```|\bfunction\b|\bclass \b|\bimport \b|\bdef |=>|\bsql\b|\bregex\b|stack ?trace|traceback|architecture|system design|design an?|refactor|optimi[sz]e|\bdebug\b|algorithm|data structure|business plan|financial|market analysis|\bstrategy\b|\bprove\b|theorem|derive|analy[sz]e|\bresearch\b|\bessay\b|dissertation|comprehensive|in detail|step[- ]by[- ]step/.test(t)
  ) return "complex";
  if (t.split(/\s+/).length > 90) return "complex";
  return "simple";
}

/**
 * Ordered model chain for the Smart router. Simple → a chain of reliable free
 * models (with the cheap gpt-4o-mini as a paid safety net). Complex → a premium
 * model first when the user can afford it, then the same free chain as fallback
 * so the request never dead-ends. run() tries each in order until one answers.
 */
function smartChain(complexity: "simple" | "complex", balance: number, models: CatalogModel[]): string[] {
  const frees = models.filter(isFree).map((m) => m.id);
  const pick = (re: RegExp) => frees.find((id) => re.test(id));
  const freeChain = [
    pick(/gpt-oss-120b/i), pick(/gemma-4/i), pick(/llama-3\.3-70b/i), pick(/qwen/i), pick(/mistral/i), pick(/nemotron/i),
    "openrouter/free", DEFAULT_MODEL, // cheap paid safety net so a signed-in user never dead-ends
  ].filter(Boolean) as string[];
  const uniqFree = [...new Set(freeChain)];
  if (complexity === "simple") return uniqFree;
  // Complex: premium first if the user has ~1 premium message of credit, else
  // best free models. Either way it falls through to the free chain.
  const premium = balance >= 10 ? [QUALITY_MODEL, DEFAULT_MODEL] : [];
  return [...new Set([...premium, ...uniqFree])];
}

// Runs quietly after each signed-in turn on a free model to capture durable
// facts about the user (ChatGPT-style memory). Output is parsed as JSON.
const MEMORY_EXTRACT_PROMPT =
  "You extract durable, long-term facts about the USER that are worth remembering across future chats — their name, location, job or role, languages, stable preferences, and ongoing projects. " +
  "Ignore anything transient, hypothetical, or specific to the current task. Write each fact as a short third-person statement (e.g. \"Lives in Pokhara\", \"Prefers replies in Nepali\"). " +
  "Return ONLY a JSON array of at most 3 strings. If there is nothing worth remembering, return [].";

const DOC_PROMPT =
  "You are AIsathi's professional document writer. Produce the COMPLETE document the user MOST RECENTLY asked for in clean, well-structured markdown: " +
  "a clear title heading, organized sections, and professional wording. Output ONLY the document itself — no commentary before or after. " +
  "Earlier conversation is background context at most — NEVER copy previous replies, previous documents, or unrelated chat content into this document. " +
  "If key details are missing (names, dates, addresses), use sensible placeholders like [Your Name]. " +
  "Use Nepali conventions when the document is for use in Nepal: addresses as Ward, Municipality/Rural Municipality, District; dates in both BS and AD where formal documents need them; रू with lakh/crore for amounts; " +
  "and the standard Nepali formats for common documents — a biodata (with personal details, citizenship number placeholder, and passport-photo note) differs from a Western resume, and official letters (nivedan) open with the office name and address, then 'विषय:' (subject), and close with the applicant's details. " +
  "Write in English unless the user asks in full Nepali or requests a Nepali-language document.";

/* ---- markdown → print-ready HTML (for the PDF download of doc messages) ---- */

function mdToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Escape first, then apply inline markdown (the markers aren't escaped, so
  // they still match; any HTML in the source is neutralized).
  const inline = (s: string) =>
    esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/~~([^~]+)~~/g, "<s>$1</s>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  const cells = (l: string) => {
    let s = l.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map((c) => c.trim());
  };
  const isSep = (l: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);

  let html = "";
  md.split("```").forEach((seg, i) => {
    if (i % 2 === 1) {
      html += `<pre><code>${esc(seg.replace(/^\w+\n/, ""))}</code></pre>`;
      return;
    }
    for (const para of seg.split(/\n{2,}/)) {
      let lines = para.split("\n").filter((l) => l.trim().length);
      if (!lines.length) continue;

      // Peel any leading heading lines so a heading glued to the text below it
      // (no blank line) still renders as a heading, and the rest classifies on.
      while (lines.length > 1) {
        const hm = lines[0].match(/^(#{1,4})\s+(.*)$/);
        if (!hm) break;
        html += `<h${hm[1].length}>${inline(hm[2])}</h${hm[1].length}>`;
        lines = lines.slice(1);
      }

      // Horizontal rule
      if (lines.length === 1 && /^\s*([-*_])\1{2,}\s*$/.test(lines[0])) { html += "<hr/>"; continue; }

      // Heading
      const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
      if (h && lines.length === 1) { html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }

      // Blockquote
      if (lines.every((l) => /^\s*>\s?/.test(l))) {
        html += `<blockquote>${lines.map((l) => inline(l.replace(/^\s*>\s?/, ""))).join("<br/>")}</blockquote>`;
        continue;
      }

      // Table
      if (lines.length >= 2 && lines[0].includes("|") && isSep(lines[1])) {
        const head = cells(lines[0]);
        const body = lines.slice(2).map(cells);
        html +=
          "<table><thead><tr>" + head.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>" +
          body.map((r) => "<tr>" + head.map((_, ci) => `<td>${inline(r[ci] ?? "")}</td>`).join("") + "</tr>").join("") +
          "</tbody></table>";
        continue;
      }

      // List — ordered vs unordered by the first marker
      if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
        const ordered = /^\s*\d+[.)]\s+/.test(lines[0]);
        const tag = ordered ? "ol" : "ul";
        html += `<${tag}>` + lines.map((l) => `<li>${inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""))}</li>`).join("") + `</${tag}>`;
        continue;
      }

      // Paragraph — soft line breaks flow together for justified prose
      html += `<p>${lines.map((l) => inline(l)).join(" ")}</p>`;
    }
  });
  return html;
}

function downloadPdf(title: string, md: string) {
  const w = window.open("", "_blank", "width=820,height=1000");
  if (!w) return;
  const safeTitle = title.replace(/[<>]/g, "").trim() || "Document";
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  // Drop a leading H1 that just repeats the document title, to avoid a double heading.
  const body = md.replace(/^\s*#\s+(.+)\n/, (m, t) => (t.trim().toLowerCase() === safeTitle.toLowerCase() ? "" : m));
  // Substantial multi-section documents get the full report treatment: a cover
  // page and automatic section numbering (1, 1.1, 1.2…). Short letters/notes
  // stay plain so a one-page reply doesn't get an awkward title page.
  const sections = (body.match(/^##\s+/gm) ?? []).length;
  const isReport = sections >= 2 || body.length > 1500;
  const cover = isReport
    ? `<section class="cover"><div class="cover-brand">AIsathi</div><h1 class="cover-title">${safeTitle.replace(/&/g, "&amp;")}</h1><div class="cover-rule"></div><div class="cover-date">${date}</div><div class="cover-src">aisathi.io</div></section>`
    : `<div class="doc-head"><span class="brand">AIsathi</span><span class="meta">${date}</span></div>`;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title><style>
    @page { size: A4; margin: 22mm 20mm 18mm; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', 'Noto Serif', serif;
      font-size: 11.5pt; line-height: 1.62; color: #1a1a1a;
      text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased;
    }
    .doc { hyphens: auto; -webkit-hyphens: auto; }
    .doc-head {
      display: flex; justify-content: space-between; align-items: baseline;
      border-bottom: 2.5px solid #e11d2e; padding-bottom: 7pt; margin-bottom: 20pt;
    }
    .doc-head .brand { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12pt; font-weight: 700; letter-spacing: -0.01em; color: #111; }
    .doc-head .meta  { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 8.5pt; letter-spacing: 0.06em; text-transform: uppercase; color: #999; }
    h1, h2, h3, h4 { font-family: Georgia, serif; color: #0f0f0f; line-height: 1.22; page-break-after: avoid; }
    h1 { font-size: 22pt; font-weight: 700; letter-spacing: -0.015em; margin: 0 0 10pt; }
    h2 { font-size: 15pt; font-weight: 700; margin: 20pt 0 6pt; padding-bottom: 3pt; border-bottom: 0.75pt solid #e0e0e0; }
    h3 { font-size: 12.5pt; font-weight: 700; margin: 15pt 0 4pt; }
    h4 { font-size: 11.5pt; font-weight: 700; margin: 12pt 0 2pt; color: #333; }
    p { margin: 0 0 8pt; text-align: justify; orphans: 2; widows: 2; }
    ul, ol { margin: 6pt 0 10pt; padding-left: 20pt; }
    li { margin: 2.5pt 0; padding-left: 3pt; }
    li::marker { color: #e11d2e; font-weight: 700; }
    blockquote { margin: 11pt 0; padding: 3pt 0 3pt 14pt; border-left: 3px solid #e11d2e; color: #444; font-style: italic; }
    code { font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', monospace; font-size: 9.5pt; background: #f2f2f3; padding: 0.5pt 4pt; border-radius: 3px; }
    pre { background: #f7f7f8; border: 0.75pt solid #e5e5e7; border-radius: 6px; padding: 11pt 13pt; overflow-x: auto; margin: 11pt 0; page-break-inside: avoid; }
    pre code { background: none; padding: 0; font-size: 9pt; line-height: 1.5; }
    table { width: 100%; border-collapse: collapse; margin: 11pt 0; font-size: 10.5pt; page-break-inside: avoid; }
    th, td { border: 0.75pt solid #ccc; padding: 5pt 8pt; text-align: left; vertical-align: top; }
    th { background: #f0f0f1; font-weight: 700; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    hr { border: 0; border-top: 0.75pt solid #ddd; margin: 16pt 0; }
    a { color: #b91c1c; text-decoration: none; }
    .doc-foot { margin-top: 26pt; padding-top: 8pt; border-top: 0.75pt solid #eee; font-family: 'Segoe UI', system-ui, sans-serif; font-size: 8.5pt; color: #aaa; display: flex; justify-content: space-between; }
    .cover { min-height: 246mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-after: always; }
    .cover-brand { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 11pt; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #999; margin-bottom: 26pt; }
    .cover-title { font-size: 32pt; font-weight: 700; letter-spacing: -0.02em; line-height: 1.15; color: #0f0f0f; margin: 0 0 18pt; max-width: 88%; page-break-after: auto; }
    .cover-rule { width: 64px; height: 3px; background: #e11d2e; margin: 0 0 18pt; }
    .cover-date { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 12pt; color: #555; }
    .cover-src { font-family: 'Segoe UI', system-ui, sans-serif; font-size: 9pt; letter-spacing: 0.06em; text-transform: uppercase; color: #bbb; margin-top: 40pt; }
    /* Automatic section numbering — reports only. */
    .doc.report { counter-reset: h2 h3 h4; }
    .report h2 { counter-reset: h3 h4; counter-increment: h2; }
    .report h3 { counter-reset: h4; counter-increment: h3; }
    .report h4 { counter-increment: h4; }
    .report h2::before { content: counter(h2) ".\\00a0\\00a0"; color: #e11d2e; }
    .report h3::before { content: counter(h2) "." counter(h3) "\\00a0\\00a0"; color: #e11d2e; }
    .report h4::before { content: counter(h2) "." counter(h3) "." counter(h4) "\\00a0\\00a0"; color: #b91c1c; }
    .report .cover h1::before { content: none; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .doc-head, .doc-foot { break-inside: avoid; } }
  </style></head><body><div class="doc${isReport ? " report" : ""}">
    ${cover}
    ${mdToHtml(body)}
    <div class="doc-foot"><span>Generated with AIsathi</span><span>aisathi.io</span></div>
  </div></body></html>`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}

function isFree(m: CatalogModel) {
  return !!m.pricing && m.pricing.prompt_npr_per_m === 0 && m.pricing.completion_npr_per_m === 0;
}

/**
 * Consumer-facing currency: credits, not rupees. 1 credit = रू0.10 of usage.
 * The ledger and API stay in NPR (docs/topup show real money — that's payment);
 * the chat surface shows only credits so users think in service, not paisa.
 */
function credits(npr: number): number {
  return Math.max(0, Math.round(npr * 10));
}
function fmtCredits(npr: number): string {
  return credits(npr).toLocaleString("en-US");
}

function fmtPrice(m: CatalogModel) {
  if (!m.pricing) return "";
  if (isFree(m)) return "Free";
  // Typical message ≈ 400 tokens in + 600 out — good enough for comparison.
  const perMsgNpr = (m.pricing.prompt_npr_per_m * 400 + m.pricing.completion_npr_per_m * 600) / 1e6;
  return `~${Math.max(1, Math.round(perMsgNpr * 10))} cr/msg`;
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
const TIERS: { label: string; icon: LucideIcon; desc: string; id: string }[] = [
  { label: "Fast", icon: Zap, desc: "Quick everyday answers — cheapest", id: "google/gemini-3.1-flash-lite" },
  { label: "Smart", icon: Brain, desc: "Best balance — Claude Sonnet", id: "anthropic/claude-sonnet-5" },
  { label: "Genius", icon: Rocket, desc: "Frontier intelligence — Claude Fable", id: "anthropic/claude-fable-5" },
];

// Gaida (गैंडा = rhino) — 3-agent agentic loops. A research/plan agent, a
// drafting agent, then a lead agent that reviews both and writes the final
// reply. Each role lists models to try in order (fallback for the free pool).
type GaidaVariant = {
  id: string; label: string; badge: string; desc: string; free: boolean;
  research: { models: string[]; web: boolean };
  draft: { models: string[] };
  lead: { models: string[] };
};
const GAIDA_VARIANTS: GaidaVariant[] = [
  {
    id: "aisathi/gaida-free", label: "Gaida Free", badge: "Free", free: true,
    desc: "3 free agents — plan, draft, review. No cost.",
    research: { models: ["nvidia/nemotron-3-super-120b-a12b:free", "openai/gpt-oss-120b:free", "openrouter/free"], web: false },
    draft: { models: ["meta-llama/llama-3.3-70b-instruct:free", "google/gemma-4-31b-it:free", "openrouter/free"] },
    lead: { models: ["google/gemma-4-31b-it:free", "openai/gpt-oss-120b:free", "openrouter/free"] },
  },
  {
    id: "aisathi/gaida-1", label: "Gaida 1", badge: "Balanced", free: false,
    desc: "GPT researches the web, GLM drafts, Claude Fable reviews.",
    research: { models: ["openai/gpt-4o-mini"], web: true },
    draft: { models: ["z-ai/glm-4.7"] },
    lead: { models: ["anthropic/claude-fable-5"] },
  },
  {
    id: "aisathi/gaida-max", label: "Gaida Max", badge: "Max", free: false,
    desc: "Best quality — GPT web research, Claude Sonnet drafts, Claude Fable reviews.",
    research: { models: ["openai/gpt-4o-mini"], web: true },
    draft: { models: ["anthropic/claude-sonnet-5"] },
    lead: { models: ["anthropic/claude-fable-5"] },
  },
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
  const AUTO: CatalogModel = { id: "openrouter/auto", name: "Auto — picks the best AI for your question" };
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
          <span className="inline-flex items-center gap-1.5">{m.name ?? m.id} {m.vision && <Camera size={12} aria-label="Understands images" />} {m.image_out && <Palette size={12} aria-label="Generates images" />}</span>
        </span>
        <span className="block truncate font-[family-name:var(--font-mono)] text-[11px]" style={{ color: "var(--text-faint)" }}>{m.id}</span>
      </span>
      <span className="flex-none text-xs font-semibold" style={{ color: isFree(m) ? "#4ade80" : "var(--text-muted)" }}>{fmtPrice(m)}</span>
    </button>
  );

  const shortName = model === SMART_MODEL ? "AISathi" : (GAIDA_VARIANTS.find((v) => v.id === model)?.label ?? (model.split("/").pop() ?? model));
  return (
    <div ref={boxRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex max-w-[40vw] items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-white/5 sm:max-w-xs"
        style={{ color: "var(--text-muted)", border: "1px solid var(--border-hairline)" }}
        title={model}
      >
        <span className="truncate">{shortName}</span>
        <ChevronDown size={13} style={{ color: "var(--text-faint)" }} />
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
                <div style={groupLabel}>Recommended</div>
                <button
                  onClick={() => { onPick(SMART_MODEL); setOpen(false); setQ(""); }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                  style={{ background: model === SMART_MODEL ? "var(--ev-red-15)" : "transparent" }}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                      <Sparkles size={15} /> AISathi Smart
                      <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: "#16a34a" }}>Auto</span>
                    </span>
                    <span className="block truncate text-[11px]" style={{ color: "var(--text-faint)" }}>Automatically picks the best model — free for simple, premium for hard.</span>
                  </span>
                </button>
                <div style={groupLabel}>Agentic — 3 agents work together</div>
                {GAIDA_VARIANTS.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => { onPick(v.id); setOpen(false); setQ(""); }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-white/5"
                    style={{ background: v.id === model ? "var(--ev-red-15)" : "transparent" }}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>
                        {v.label}
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white" style={{ background: v.free ? "#16a34a" : "var(--ev-red)" }}>{v.badge}</span>
                      </span>
                      <span className="block truncate text-[11px]" style={{ color: "var(--text-faint)" }}>{v.desc}</span>
                    </span>
                  </button>
                ))}
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
                        <span className="flex items-center gap-2 truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}><t.icon size={15} /> {t.label}</span>
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
            {free.length > 0 && <div style={groupLabel}>Free ({free.length}) — works without credits</div>}
            {free.map(row)}
            {paid.length > 0 && <div style={groupLabel}>Premium ({paid.length}) — approx credits per message</div>}
            {paid.map(row)}
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
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [models, setModels] = useState<CatalogModel[]>([]);
  // Workspace mode — an explicit tool tab. "chat" auto-detects intent as before;
  // "image" / "doc" force that pipeline so the user deliberately picks the tool.
  const [mode, setMode] = useState<"chat" | "image" | "doc">("chat");
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
  const [editingIdx, setEditingIdx] = useState<number | null>(null); // editing a user message
  const [editText, setEditText] = useState("");
  const [chatQuery, setChatQuery] = useState(""); // sidebar conversation search
  const [followups, setFollowups] = useState<string[]>([]); // suggested next questions
  const [listening, setListening] = useState(false);
  const [webMode, setWebMode] = useState<"off" | "auto" | "on">("off"); // web search: off / auto-detect / always
  const [lang, setLang] = useState<"en" | "ne">("en"); // reply language toggle
  const langRef = useRef<"en" | "ne">("en");
  const [demoUsed, setDemoUsed] = useState(0); // signed-out free-message counter
  const [docs, setDocs] = useState<{ name: string; text: string; pages: number; url: string; scanned?: boolean; file?: File }[]>([]); // pending PDF attachments
  const [docBusy, setDocBusy] = useState(false); // reading a PDF
  const [docStatus, setDocStatus] = useState("Reading PDF…"); // attach/OCR progress label
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoryToast, setMemoryToast] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const memoriesRef = useRef<Memory[]>([]);
  const [artifact, setArtifact] = useState<Artifact | null>(null); // open live-preview artifact
  // Reply feedback: which messages this browser voted on ("chatId:idx" -> vote),
  // persisted locally so buttons stay filled across reloads. Votes feed the
  // feedback table (training data) and the monthly रू1,000 lucky draw.
  const [voted, setVoted] = useState<Record<string, "up" | "down">>({});
  const [fbPromoSeen, setFbPromoSeen] = useState(true); // default hidden until localStorage read
  const recRef = useRef<{ stop: () => void } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scrollBoxRef = useRef<HTMLDivElement>(null);
  // Smart auto-scroll: follow the stream only while the user is at the bottom.
  // The moment they scroll up (to reread earlier messages mid-generation) we
  // stop yanking the view down; scrolling back near the bottom re-engages.
  const stickToBottomRef = useRef(true);
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
    // Always end on a reliable, platform-funded model so a logged-out visitor
    // never hits a dead end when every free model is rate-limited upstream.
    // The server allows this one model in the demo lane (capped + IP-limited).
    return [...uniq, DEFAULT_MODEL];
  }

  useEffect(() => {
    setApiKey(localStorage.getItem("nepalai_key") ?? "");
    const savedLang = (localStorage.getItem("aisathi_lang") as "en" | "ne") || "en";
    setLang(savedLang); langRef.current = savedLang;
    setDemoUsed(Number(localStorage.getItem("aisathi_demo_used") ?? 0));
    const savedMode = localStorage.getItem("aisathi_mode");
    if (savedMode === "image" || savedMode === "doc") setMode(savedMode);
    try { setVoted(JSON.parse(localStorage.getItem("aisathi_votes") ?? "{}")); } catch { /* fresh */ }
    setFbPromoSeen(localStorage.getItem("aisathi_fb_promo") === "1");
    try {
      const saved = JSON.parse(localStorage.getItem("aisathi_chats") ?? "[]") as Chat[];
      setChats(saved);
      chatsRef.current = saved;
      // Always open a fresh "New chat" on visit — past chats stay in the
      // sidebar to reopen manually (like starting ChatGPT/Claude anew).
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
            // Don't auto-open a synced chat either — keep the fresh New chat view.
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
  useEffect(() => {
    if (stickToBottomRef.current) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats, chatId]);
  // Switching chats always starts pinned to the latest message.
  useEffect(() => { stickToBottomRef.current = true; }, [chatId]);
  useEffect(() => { memoriesRef.current = memories; }, [memories]);

  // Remember the user's explicit model choice across sessions.
  const pickModel = useCallback((id: string) => {
    setModel(id);
    try { localStorage.setItem("aisathi_model", id); } catch { /* quota */ }
  }, []);

  // Default model: the saved choice if any; otherwise AISathi Smart for
  // signed-in users (the auto-router picks free vs premium per message).
  useEffect(() => {
    const saved = localStorage.getItem("aisathi_model");
    if (saved) { setModel(saved); return; }
    if (session) setModel(SMART_MODEL);
  }, [session]);

  // Safety net: if the selected model isn't a valid chat model anymore — e.g. a
  // content-safety classifier we've since hidden, or a delisted model — reset
  // to AISathi Smart / the default so nobody stays stuck talking to a model
  // that only replies "User Safety: safe".
  useEffect(() => {
    if (!models.length) return;
    const special = model.startsWith("aisathi/") || model === "openrouter/auto" || model === "openrouter/free";
    if (special || models.some((m) => m.id === model)) return;
    const fallback = session ? SMART_MODEL : DEFAULT_MODEL;
    setModel(fallback);
    try { localStorage.setItem("aisathi_model", fallback); } catch { /* quota */ }
  }, [models, model, session]);

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
      `_Exported from AIsathi (aisathi.io) · ${fmtCredits(chatCost)} credits used_`,
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
    ...(bestFreeCmd ? [{ cmd: "free", hint: `Switch to a free model (${bestFreeCmd.id.split("/").pop()})`, run: () => { pickModel(bestFreeCmd.id); setInput(""); } }] : []),
    { cmd: "auto", hint: "Switch to Auto — best model per question", run: () => { pickModel("openrouter/auto"); setInput(""); } },
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
      if (found) { pickModel(found.id); setInput(""); }
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
        if (f.size > 50 * 1024 * 1024) { setError("PDFs max 50MB."); continue; }
        setError("");
        setDocStatus("Reading PDF…");
        setDocBusy(true);
        try {
          const pdf = await import("@/lib/pdf");
          const url = await pdf.fileToDataUrl(f);
          const { text, pages, scanned } = await pdf.extractPdfText(f);
          // Don't auto-OCR (it's heavy) — flag scanned PDFs and offer a button.
          setDocs((cur) => [...cur, { name: f.name, text, pages, url, scanned: scanned || !text, file: f }].slice(0, 3));
        } catch {
          setError(`Couldn't read "${f.name}".`);
        } finally {
          setDocBusy(false);
        }
      } else {
        // Word / Excel / PowerPoint / text — extract text client-side.
        const files = await import("@/lib/files");
        if (!files.isSupportedDoc(f)) { setError("Attach images, PDFs, Word, Excel, PowerPoint or text files."); continue; }
        if (f.size > 50 * 1024 * 1024) { setError("Files max 50MB."); continue; }
        setError("");
        setDocStatus(`Reading ${f.name.split(".").pop()?.toUpperCase()}…`);
        setDocBusy(true);
        try {
          const { text } = await files.extractFileText(f);
          if (!text) setError(`"${f.name}" has no readable text.`);
          setDocs((cur) => [...cur, { name: f.name, text, pages: 0, url: "" }].slice(0, 3));
        } catch {
          setError(`Couldn't read "${f.name}".`);
        } finally {
          setDocBusy(false);
        }
      }
    }
  }

  /** Opt-in OCR for a scanned PDF (heavy — user-triggered, capped 15 pages). */
  async function runOcr(i: number) {
    const d = docs[i];
    if (!d?.file || docBusy) return;
    setError("");
    setDocStatus("Loading OCR…");
    setDocBusy(true);
    try {
      const pdf = await import("@/lib/pdf");
      const { text } = await pdf.ocrPdf(d.file, 15, (p, n) => setDocStatus(`Running OCR — page ${p}/${n}…`));
      if (text) setDocs((cur) => cur.map((x, xi) => (xi === i ? { ...x, text, scanned: false } : x)));
      else setError(`OCR found no text in "${d.name}".`);
    } catch {
      setError(`Couldn't OCR "${d.name}".`);
    } finally {
      setDocBusy(false);
    }
  }

  /** Quietly capture durable facts about the user after a turn (ChatGPT-style
   *  memory). Runs on a FREE model so it never costs the user anything; any
   *  failure (e.g. free pool busy) is silently skipped. */
  /** Suggest 3 short follow-up questions after a reply (free model, best-effort). */
  async function generateFollowups(userText: string, replyText: string) {
    const authKey = apiKey || "demo";
    if (!replyText || replyText.length < 20) return;
    try {
      const res = await fetch("/api/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authKey}` },
        body: JSON.stringify({
          // Cheap + reliable for signed-in users (~रू0.0005); free/best-effort for demo.
          model: apiKey ? "openai/gpt-4o-mini" : "openrouter/free",
          messages: [
            { role: "system", content: "Suggest exactly 3 short, natural follow-up questions the user might ask next, based on the conversation. Each under 9 words, phrased as the user would type. Return ONLY a JSON array of 3 strings." + (langRef.current === "ne" ? " Write them in Nepali." : "") },
            { role: "user", content: `User asked: ${userText.slice(0, 500)}\n\nAssistant replied: ${replyText.slice(0, 1500)}` },
          ],
          max_tokens: 120,
        }),
      });
      if (!res.ok) return;
      const j = await res.json();
      const raw: string = j.choices?.[0]?.message?.content ?? "[]";
      const arr: unknown = JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]");
      if (!Array.isArray(arr)) return;
      const clean = arr.filter((s): s is string => typeof s === "string" && s.trim().length > 2 && s.length < 80).slice(0, 3);
      if (clean.length) setFollowups(clean);
    } catch { /* best-effort */ }
  }

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

  /** Forces the reply language per the top-right toggle. */
  function langDirective(): string {
    return langRef.current === "ne"
      ? "\n\nIMPORTANT: Reply entirely in Nepali (Devanagari script), no matter what language the user writes in."
      : "\n\nIMPORTANT: Reply in clear English, no matter what language the user writes in.";
  }

  /** Set + remember the reply language. */
  const pickLang = useCallback((l: "en" | "ne") => {
    setLang(l);
    langRef.current = l;
    try { localStorage.setItem("aisathi_lang", l); } catch { /* quota */ }
  }, []);

  /** System prompt for normal chat, with the user's persistent memory injected. */
  function systemWithMemory(): string {
    const mem = memoriesRef.current;
    const base = mem.length
      ? SYSTEM_PROMPT + "\n\nThings you remember about this user (use naturally when relevant; do not recite them back):\n" + mem.map((m) => `- ${m.content}`).join("\n")
      : SYSTEM_PROMPT;
    return base;
  }

  /* ---- send / stream / regenerate ---- */
  async function run(history: Msg[], id: string, all: Chat[], opts?: { model?: string; system?: string; doc?: boolean; key?: string; fallbacks?: string[]; displayAs?: string }) {
    const useKey = opts?.key ?? apiKey;
    const candidates = [opts?.model ?? model, ...(opts?.fallbacks ?? [])];
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      // RAG: pull verified Nepal facts relevant to the question and inject
      // them into the system prompt. Best-effort with a hard time budget —
      // a slow lookup must never delay the reply noticeably.
      const ragQuery = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
      let ragBlock = "";
      if (ragQuery.length >= 8) {
        try {
          const kn = await Promise.race([
            fetch("/api/knowledge/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ q: ragQuery.slice(0, 500) }),
              signal: ac.signal,
            }).then((r) => (r.ok ? r.json() : null)),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
          ]);
          const matches = (kn?.matches ?? []) as { title: string; content: string; source?: string; as_of?: string; similarity: number }[];
          if (matches.length) {
            ragBlock =
              "\n\nVerified Nepal knowledge relevant to this question (curated " +
              (matches[0].as_of ? `as of ${matches[0].as_of}` : "recently") +
              "; prefer these facts over your training memory; where fees or rules may have changed, say so and point to the official source):\n" +
              matches.map((m) => `- ${m.title}: ${m.content}${m.source ? ` [source: ${m.source}]` : ""}`).join("\n");
          }
        } catch { /* RAG is best-effort */ }
      }
      const apiMessages: unknown[] = [{ role: "system", content: (opts?.system ?? systemWithMemory()) + langDirective() + ragBlock }];
      // Document requests: only the recent exchange matters (the ask + at most
      // one revision round). Sending the whole chat makes the model copy
      // earlier, unrelated conversation into the document.
      const ctxHistory = opts?.doc ? history.slice(-4) : history;
      ctxHistory.forEach((m) => {
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
      // Web search: on (always), auto (when the question needs current info),
      // or off. Never in the demo lane (free-only, and search costs money).
      const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
      const useWeb = useKey !== "demo" && (webMode === "on" || (webMode === "auto" && needsWeb(lastUser)));
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
          body: JSON.stringify({
            model: useModel, messages: apiMessages, stream: true, max_tokens: 4096,
            ...(useWeb ? { plugins: [{ id: "web", max_results: 4 }] } : {}),
          }),
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
              all = updateChat(id, [...history, { role: "assistant", content: reply, model: opts?.displayAs ?? useModel }], all);
              setChats(all);
            }
          } catch { /* partial line */ }
        }
      }
      persist(updateChat(id, [...history, { role: "assistant", content: reply || "(empty reply)", costNpr: cost, model: opts?.displayAs ?? useModel, doc: opts?.doc }], all));
      // Claude-style: auto-open the latest substantial artifact in the side panel.
      const arts = extractArtifacts(reply);
      if (arts.length) setArtifact(arts[arts.length - 1]);
      // Suggest follow-up questions for the latest reply.
      const lastUserMsg = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
      if (reply) void generateFollowups(lastUserMsg, reply);
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
        content: reply?.content || (outImgs.length ? "Here you go! Click the image to download." : "The model returned no image — try describing it differently."),
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

  /**
   * Text-to-video via /api/video (Replicate under the hood). Video is async:
   * we submit the prompt, then poll for the finished clip while showing a live
   * "generating…" status in the assistant bubble. Signed-in only (needs a key).
   */
  async function runVideo(history: Msg[], id: string, all: Chat[]) {
    const prompt = history[history.length - 1]?.content ?? "";
    if (!apiKey) {
      persist(updateChat(id, [...history, {
        role: "assistant",
        content: "Video generation needs an account. **Sign in** (or add credits) and try again — then say *\"make a video of ...\"*.",
        model: "aisathi/video",
      }], all));
      return;
    }
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const started = Date.now();
    const show = (content: string) => {
      all = updateChat(id, [...history, { role: "assistant", content, model: "aisathi/video" }], all);
      setChats(all);
    };
    try {
      show("Generating your video… this usually takes about a minute.");
      const res = await fetch("/api/v1/video", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ prompt }),
        signal: ac.signal,
      });
      const created = await res.json().catch(() => null);
      if (!res.ok) {
        persist(updateChat(id, [...history, { role: "assistant", content: created?.error ?? `Couldn't start video (error ${res.status}).`, model: "aisathi/video" }], all));
        return;
      }
      const predId = created.id as string;
      // Poll until the clip is ready (or fails). Cap at ~4 minutes.
      for (let i = 0; i < 80; i++) {
        if (ac.signal.aborted) return;
        await new Promise((r) => setTimeout(r, 3000));
        const s = await fetch(`/api/v1/video?id=${encodeURIComponent(predId)}`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: ac.signal,
        });
        const st = await s.json().catch(() => null);
        const secs = Math.round((Date.now() - started) / 1000);
        if (st?.status === "succeeded" && st?.url) {
          persist(updateChat(id, [...history, {
            role: "assistant",
            content: "Here's your video — hover to play, or use the ⋯ menu to download.",
            video: st.url,
            model: "aisathi/video",
          }], all));
          return;
        }
        if (st?.status === "failed" || st?.status === "canceled") {
          persist(updateChat(id, [...history, { role: "assistant", content: `Video generation ${st.status}. ${st?.error ?? "Try a simpler prompt."}`.trim(), model: "aisathi/video" }], all));
          return;
        }
        show(`Generating your video… ${secs}s elapsed (${st?.status ?? "working"}).`);
      }
      persist(updateChat(id, [...history, { role: "assistant", content: "The video is taking longer than expected. It may still finish — try again in a moment.", model: "aisathi/video" }], all));
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

  /**
   * Gaida — a 3-agent agentic loop (see GAIDA_VARIANTS). A research/plan agent,
   * a drafting agent, then a lead agent that reviews both and streams the final
   * reply. Each role tries its models in order (fallback for the free pool).
   * Progress shows live; total cost is the sum of all calls (रू0 for free).
   */
  async function runGaida(history: Msg[], id: string, all: Chat[], variant: GaidaVariant) {
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const userMsg = history[history.length - 1].content;
    let totalCost = 0;

    const step1 = variant.research.web ? "Researching the web" : "Planning & analysis";
    const STEPS = [step1, "Drafting the answer", "Reviewing & finalizing"];
    const doneFlags = [false, false, false];
    const statusText = (active: number) =>
      `**${variant.label}** — three agents working together\n\n` +
      STEPS.map((s, i) => `${i + 1}. ${s} — ${doneFlags[i] ? "done" : i === active ? "working…" : "waiting"}`).join("\n");
    const showStatus = (active: number) => {
      all = updateChat(id, [...history, { role: "assistant", content: statusText(active), model: variant.id }], all);
      setChats(all);
    };

    // Non-streaming call over a fallback list; skips empty replies (free pool).
    const askChain = async (mdls: string[], messages: unknown[], web: boolean): Promise<{ content: string; cost: number }> => {
      let lastErr = "";
      for (const m of mdls) {
        try {
          const body: Record<string, unknown> = { model: m, messages, max_tokens: 2048 };
          if (web) body.plugins = [{ id: "web", max_results: 4 }];
          const res = await fetch("/api/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: ac.signal,
          });
          const j = await res.json();
          if (!res.ok) { lastErr = j?.error?.message ?? `Error ${res.status}`; continue; }
          const content = String(j.choices?.[0]?.message?.content ?? "");
          if (content.trim()) {
            if (j.nepalai?.balance_npr != null) setBalance(j.nepalai.balance_npr);
            return { content, cost: Number(j.nepalai?.cost_npr ?? 0) };
          }
        } catch (e) {
          if ((e as Error).name === "AbortError") throw e;
          lastErr = String(e);
        }
      }
      throw new Error(lastErr || "All models were busy — please try again.");
    };

    try {
      // 1. Research (web) or plan (free)
      showStatus(0);
      const researchSys = variant.research.web
        ? "You are the RESEARCH agent. Analyse the user's request and search the web for current, factual information. Return concise findings: key facts, figures, and source names. Be brief and neutral — do not write the final answer."
        : "You are the PLANNING agent. Analyse the user's request and outline what a great answer needs: the key points to cover, relevant facts you know, and any pitfalls to avoid. Be concise — do not write the final answer.";
      const research = await askChain(variant.research.models, [
        { role: "system", content: researchSys },
        { role: "user", content: userMsg },
      ], variant.research.web);
      totalCost += research.cost; doneFlags[0] = true;

      // 2. Draft
      showStatus(1);
      const draft = await askChain(variant.draft.models, [
        { role: "system", content: SYSTEM_PROMPT + "\nYou are the DRAFTING agent. Write a complete, well-structured first-draft answer that fully addresses the user's request." },
        { role: "user", content: userMsg },
      ], false);
      totalCost += draft.cost; doneFlags[1] = true;

      // 3. Review + finalize (streamed; pre-flight fallback across lead models)
      showStatus(2);
      const leadMessages = [
        { role: "system", content: systemWithMemory() + "\nYou are the LEAD reviewer. You receive the user's request, notes from a research/planning agent, and a draft from a drafting agent. Check both for accuracy and completeness, correct any errors, fill gaps, and write the single best final answer for the user. Output ONLY the polished final answer — no notes about the process." },
        { role: "user", content: `USER REQUEST:\n${userMsg}\n\nRESEARCH / NOTES:\n${research.content || "(none)"}\n\nDRAFT:\n${draft.content || "(none)"}` },
      ];
      let res: Response | null = null;
      for (const m of variant.lead.models) {
        const r = await fetch("/api/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model: m, stream: true, max_tokens: 4096, messages: leadMessages }),
          signal: ac.signal,
        });
        if (r.ok && r.body) { res = r; break; }
      }
      if (!res || !res.body) {
        throw new Error("The final reviewer was busy — please try again.");
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
            if (j.nepalai) { cost = j.nepalai.cost_npr ?? null; if (j.nepalai.balance_npr != null) setBalance(j.nepalai.balance_npr); }
            const delta = j.choices?.[0]?.delta?.content;
            if (delta) {
              reply += delta;
              all = updateChat(id, [...history, { role: "assistant", content: reply, model: variant.id }], all);
              setChats(all);
            }
          } catch { /* partial */ }
        }
      }
      totalCost += cost ?? 0;
      persist(updateChat(id, [...history, { role: "assistant", content: reply || "(no answer)", costNpr: Number(totalCost.toFixed(4)), model: variant.id }], all));
      const arts = extractArtifacts(reply);
      if (arts.length) setArtifact(arts[arts.length - 1]);
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message || String(e));
        persist(updateChat(id, history, all)); // roll back the status message
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  async function send(text?: string, editIndex?: number) {
    const content = (text ?? input).trim();
    if ((!content && images.length === 0 && docs.length === 0) || busy || docBusy) return;

    // Signed-out visitor: run the free demo lane until the cap, then invite signup.
    if (demoMode) {
      if (demoLeft <= 0) { setError("__DEMO_LIMIT__"); return; }
      if (mode === "image") { setError("Sign up free to create images — the demo is text chat only."); return; }
      if (mode === "doc") { setError("Sign up free to create documents — the demo is text chat only."); return; }
      if (images.length || docs.length) { setError("Sign up free to chat with images and PDFs — the demo is text-only."); return; }
    } else if (!apiKey.trim()) {
      setError("Setting up your account — try again in a second.");
      return;
    }

    setError("");
    setInput("");
    setFollowups([]);
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
    } else if (editIndex != null) {
      // Edit & branch: drop the edited message and everything after it, then resend.
      all = updateChat(chat.id, chat.messages.slice(0, editIndex), chats);
    }
    const base = all.find((c) => c.id === id)!.messages;
    const next: Msg[] = [...base, {
      role: "user",
      content: content || defaultPrompt,
      images: imgs.length ? imgs : undefined,
      attachments: attached.length ? attached.map((d) => ({ name: d.name, pages: d.pages, url: d.url })) : undefined,
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

    // Explicit tool tab overrides everything: the user chose Image / Document,
    // so force that pipeline regardless of what the text looks like.
    if (mode === "image") {
      await runImage(next, id, all);
      return;
    }
    if (mode === "doc") {
      await run(next, id, all, { model: docModel(), system: DOC_PROMPT, doc: true });
      return;
    }

    // Chat mode — creator router runs FIRST so media creation still works from
    // a typed prompt ("make an image of…") even in the default Chat tab.
    const intent = content ? detectIntent(content) : "chat";
    if (intent === "image") {
      await runImage(next, id, all);
      return;
    }
    if (intent === "video") {
      await runVideo(next, id, all);
      return;
    }

    // Gaida — 3-agent agentic loop (signed-in only), for non-media requests.
    const gaidaVariant = GAIDA_VARIANTS.find((v) => v.id === model);
    if (gaidaVariant) {
      await runGaida(next, id, all, gaidaVariant);
      return;
    }

    if (intent === "doc") {
      await run(next, id, all, { model: docModel(), system: DOC_PROMPT, doc: true });
      return;
    }

    // AISathi Smart: classify the request and route free vs premium behind one
    // "AISathi AI Assistant" identity (displayAs hides the real engine).
    if (model === SMART_MODEL) {
      const complexity = attached.length > 0 ? "complex" : classifyComplexity(content);
      const chain = smartChain(complexity, balance ?? 0, models);
      await run(next, id, all, { model: chain[0], fallbacks: chain.slice(1), displayAs: SMART_MODEL });
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

  /** Save an edited user message and re-run from that point (branch). */
  async function submitEdit() {
    if (editingIdx == null || busy) return;
    const idx = editingIdx;
    const text = editText.trim();
    setEditingIdx(null);
    if (!text) return;
    await send(text, idx);
  }

  function copyMessage(i: number, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedIdx(i);
    setTimeout(() => setCopiedIdx(null), 1500);
  }

  /** Vote on an assistant reply. Fire-and-forget; the button fills instantly. */
  function sendFeedback(i: number, vote: "up" | "down") {
    if (!chat) return;
    const key = `${chat.id}:${i}`;
    if (voted[key]) return; // one vote per reply per browser
    const next = { ...voted, [key]: vote };
    setVoted(next);
    try { localStorage.setItem("aisathi_votes", JSON.stringify(next)); } catch { /* full */ }
    const msg = chat.messages[i];
    const question = [...chat.messages.slice(0, i)].reverse().find((m) => m.role === "user")?.content ?? "";
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey || "demo"}` },
      body: JSON.stringify({
        vote, model: msg?.model, question: question.slice(0, 4000),
        answer: (msg?.content ?? "").slice(0, 8000), chat_id: chat.id, msg_index: i,
      }),
    }).catch(() => { /* feedback is best-effort */ });
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
        You&apos;ve used <strong>{usage.pct}%</strong> of your credits · {fmtCredits(usage.left)} credits left
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

  // Lucky-draw promo: shown until dismissed. Every rated reply = one entry in
  // the monthly रू1,000 draw (signed-in users; winner needs an account to pay).
  const fbPromoBanner = !fbPromoSeen && (
    <div
      className="flex items-center gap-3 px-4 py-2.5 text-[13px]"
      style={{ background: "rgba(74, 222, 128, 0.08)", borderBottom: "1px solid rgba(74, 222, 128, 0.25)", color: "var(--text-body)" }}
    >
      <Gift size={15} className="flex-none" style={{ color: "#4ade80" }} aria-hidden />
      <span className="min-w-0 flex-1">
        Rate replies with <ThumbsUp size={11} className="inline" aria-label="thumbs up" /> / <ThumbsDown size={11} className="inline" aria-label="thumbs down" /> — every rating is an entry in this month&apos;s <strong>रू1,000 lucky draw</strong>.{!session && " Sign in so we can pay you if you win!"}
      </span>
      <button
        onClick={() => { setFbPromoSeen(true); localStorage.setItem("aisathi_fb_promo", "1"); }}
        className="flex-none px-1" style={{ color: "var(--text-faint)" }} title="Dismiss"
      >
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
            <strong>That&apos;s your {DEMO_CAP} free messages</strong> — sign up free to keep chatting. Unlimited free models, no card needed.
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
              onClick={() => { pickModel(bestFree.id); setError(""); }}
              className="flex-none rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}
            >
              Use a free model
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
            <Sparkles size={14} className="mr-1 inline-block align-text-bottom" />You&apos;re trying AIsathi free — <strong>{demoLeft}</strong> {demoLeft === 1 ? "message" : "messages"} left. Sign up for unlimited chats, images &amp; every model.
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
          <span className="flex min-w-0 flex-1 items-center gap-1.5"><Camera size={14} className="flex-none" /><span><strong>{model.split("/").pop()}</strong> can&apos;t see images.</span></span>
          {bestVision && (
            <button
              onClick={() => pickModel(bestVision.id)}
              className="flex-none rounded-full px-4 py-1.5 text-xs font-bold"
              style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}
            >
              Switch to {bestVision.id.split("/").pop()}
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
                <FileText size={14} aria-hidden />
                <span className="max-w-[160px] truncate" style={{ color: "var(--text-body)" }}>{d.name}</span>
                {d.pages > 0 && <span style={{ color: "var(--text-faint)" }}>{d.pages}p</span>}
                {d.scanned && <button onClick={() => runOcr(i)} disabled={docBusy} className="font-semibold disabled:opacity-40" style={{ color: "var(--ev-red)" }} title="Scanned PDF — extract text with OCR">Run OCR</button>}
                {d.url && <button onClick={() => setArtifact({ id: `pdf-${i}`, title: d.name, kind: "pdf", lang: "pdf", code: d.url })} className="font-semibold" style={{ color: "var(--ev-red)" }}>View</button>}
                <button onClick={() => setDocs(docs.filter((_, x) => x !== i))} className="font-bold" style={{ color: "var(--text-faint)" }}>×</button>
              </div>
            ))}
            {docBusy && (
              <span className="flex items-center gap-2 px-2 py-1.5 text-xs italic" style={{ color: "var(--text-faint)" }}>
                <span className="thinking-shimmer">{docStatus}</span>
              </span>
            )}
          </div>
        )}
        {/* Tool tabs — pick the workspace: Chat, Image, or Document. */}
        <div className="mb-1.5 flex gap-1 px-1">
          {([
            { id: "chat", label: "Chat", icon: Sparkles },
            { id: "image", label: "Image", icon: Palette },
            { id: "doc", label: "Document", icon: FileText },
          ] as const).map((m) => (
            <button
              key={m.id}
              onClick={() => { setMode(m.id); try { localStorage.setItem("aisathi_mode", m.id); } catch { /* quota */ } inputRef.current?.focus(); }}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors"
              style={mode === m.id
                ? { background: "var(--ev-red-15)", color: "var(--text-strong)", border: "1px solid var(--border-accent)" }
                : { color: "var(--text-muted)", border: "1px solid transparent" }}
              title={m.id === "image" ? "Create images" : m.id === "doc" ? "Write documents & PDFs" : "General chat"}
            >
              <m.icon size={13} /> {m.label}
            </button>
          ))}
        </div>
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
            mode === "image" ? "Describe an image to create — e.g. a rhino on Everest at sunrise…"
            : mode === "doc" ? "Describe the document — e.g. a 3-day leave application to my office…"
            : apiKey ? "Ask your साथी anything…  ( / for commands )"
            : demoMode ? `Ask anything — ${demoLeft} free ${demoLeft === 1 ? "message" : "messages"}, no sign-up…`
            : "Setting up your account…"
          }
          disabled={!apiKey && !session && demoLeft <= 0}
          className="max-h-44 w-full resize-none bg-transparent px-2 pt-1 text-[15px] outline-none placeholder:text-zinc-600"
          style={{ color: "var(--text-strong)" }}
        />
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.docx,.xlsx,.xls,.csv,.pptx,.txt,.md,.json,.log" multiple hidden onChange={(e) => { attachFiles(e.target.files); e.target.value = ""; }} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 3 && docs.length >= 3}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-base transition-colors hover:bg-white/5 disabled:opacity-30"
            style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}
            title="Attach a file — image, PDF, Word, Excel, PowerPoint or text"
          >
            <Paperclip size={16} />
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
            {listening ? <Square size={14} fill="currentColor" /> : <Mic size={16} />}
          </button>
          {!demoMode && (
            <button
              onClick={() => setWebMode((m) => (m === "off" ? "auto" : m === "auto" ? "on" : "off"))}
              className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-colors hover:bg-white/5"
              style={{
                border: `1px solid ${webMode !== "off" ? "var(--ev-red)" : "var(--border-hairline)"}`,
                color: webMode !== "off" ? "var(--ev-red)" : "var(--text-muted)",
                background: webMode !== "off" ? "var(--ev-red-15)" : "transparent",
              }}
              title={
                webMode === "off" ? "Web search off — click for Auto (searches when a question needs current info), then Always"
                : webMode === "auto" ? "Web search: Auto — searches only when the question needs current info (~9 credits per search)"
                : "Web search: Always on — every reply uses live results (~9 credits per search)"
              }
            >
              <Globe size={14} /> {webMode === "off" ? "Web" : webMode === "auto" ? "Web · Auto" : "Web · On"}
            </button>
          )}
          <ModelPicker models={models} model={model} onPick={pickModel} />
          {balance !== null && (
            balance < 10 ? (
              <a href="/topup" className="hidden text-xs font-semibold no-underline sm:inline" style={{ color: "var(--ev-red)" }} title="Balance is low — top up">
                {fmtCredits(balance ?? 0)} credits · top up
              </a>
            ) : (
              <span className="hidden text-xs sm:inline" style={{ color: "var(--text-faint)" }}>{fmtCredits(balance ?? 0)} credits</span>
            )
          )}
          <div className="flex-1" />
          {busy ? (
            <button onClick={() => abortRef.current?.abort()} className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ border: "1px solid var(--border-strong)", color: "var(--text-strong)" }} title="Stop">
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => send()}
              // Enabled whenever there's something to send. Demo (logged-out)
              // users must be able to send too — send() routes them to the free
              // demo lane and enforces the message cap. (Previously an
              // `(!apiKey && !session)` clause left every logged-out visitor's
              // Send button permanently greyed out.)
              disabled={!input.trim() && images.length === 0}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold text-white transition-colors disabled:opacity-30"
              style={{ background: "var(--accent)" }}
              title="Send"
            >
              <ArrowUp size={18} />
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
        {chats.length > 3 && (
          <input
            value={chatQuery}
            onChange={(e) => setChatQuery(e.target.value)}
            placeholder="Search chats…"
            className="mt-2 w-full rounded-md px-3 py-1.5 text-xs outline-none"
            style={{ background: "var(--surface-inset)", border: "1px solid var(--border-hairline)", color: "var(--text-strong)" }}
          />
        )}
      </div>
      <div className="sathi-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {chats.length === 0 && (
          <p className="px-2 pt-2 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
            Your conversations live here — stored in your browser only. Double-click to rename.
          </p>
        )}
        {(() => {
          const q = chatQuery.trim().toLowerCase();
          const shown = q ? chats.filter((c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q))) : chats;
          if (q && shown.length === 0) return <p className="px-2 pt-2 text-xs" style={{ color: "var(--text-faint)" }}>No chats match &quot;{chatQuery}&quot;.</p>;
          return shown.map((c) => (
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
          ));
        })()}
      </div>
      {session && (
        <button
          onClick={() => setMemoryOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-left text-xs transition-colors hover:bg-white/5"
          style={{ borderTop: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}
        >
          <Brain size={15} aria-hidden /> Memory
          <span className="ml-auto" style={{ color: "var(--text-faint)" }}>{memories.length || ""}</span>
        </button>
      )}
      <div className="p-4 text-xs" style={{ borderTop: "1px solid var(--border-hairline)", color: "var(--text-faint)" }}>
        {session ? (
          <>
            {fullName ?? session.user.email}
            {balance !== null && <span className="float-right font-semibold" style={{ color: "var(--text-muted)" }}>{fmtCredits(balance)} cr</span>}
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
          <div className="flex items-center gap-2 font-semibold"><Brain size={16} aria-hidden /> What AIsathi remembers</div>
          <button onClick={() => setMemoryOpen(false)} style={{ color: "var(--text-faint)" }}><X size={16} /></button>
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
                    <X size={14} />
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
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold shadow-lg" style={{ background: "#141414", border: "1px solid var(--border-strong)", color: "var(--text-strong)" }}>
      <Brain size={14} /> Memory updated
    </div>
  );

  // Reply-language toggle (English / Nepali) — controls the answer language.
  const langToggle = (
    <div className="flex flex-none items-center rounded-lg p-0.5 text-xs font-semibold" style={{ border: "1px solid var(--border-hairline)", background: "var(--surface-header)" }} title="Choose the reply language">
      <button
        onClick={() => pickLang("en")}
        className="rounded-md px-2.5 py-1 transition-colors"
        style={lang === "en" ? { background: "var(--ev-white-10)", color: "var(--text-strong)" } : { color: "var(--text-muted)" }}
      >
        EN
      </button>
      <button
        onClick={() => pickLang("ne")}
        className="rounded-md px-2.5 py-1 transition-colors"
        style={lang === "ne" ? { background: "var(--ev-white-10)", color: "var(--text-strong)" } : { color: "var(--text-muted)" }}
      >
        <span lang="ne">नेपाली</span>
      </button>
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

        <main className="relative flex min-w-0 flex-1 flex-col">
          {/* Reply-language toggle, floated top-right on the empty state. */}
          {messages.length === 0 && (
            <div className="absolute right-4 top-3 z-20">{langToggle}</div>
          )}
          {usageBanner}
          {fbPromoBanner}
          {/* Chat header (only when a conversation is open) */}
          {messages.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2" style={{ borderBottom: "1px solid var(--border-hairline)" }}>
              <button onClick={() => setSidebarOpen(true)} className="flex items-center rounded-md px-2 py-1.5 md:hidden" style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}>
                <Menu size={16} />
              </button>
              <span className="min-w-0 flex-1 truncate text-sm font-medium" onDoubleClick={() => chat && renameChat(chat.id)} title="Double-click to rename">
                {chat?.title}
              </span>
              {chatCost > 0 && (
                <span className="hidden text-[11px] sm:inline" style={{ color: "var(--text-faint)" }}>
                  this chat: {fmtCredits(chatCost)} credits
                </span>
              )}
              {langToggle}
              {session && (
                <button onClick={shareChat} disabled={shared === "sharing"} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/5" style={{ border: "1px solid var(--border-hairline)", color: shared === "copied" ? "var(--ev-red)" : "var(--text-muted)" }} title="Create a public link to this conversation">
                  {shared === "copied" ? <><Check size={13} /> Link copied</> : shared === "sharing" ? "…" : <><Link2 size={13} /> Share</>}
                </button>
              )}
              <button onClick={exportChat} className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors hover:bg-white/5" style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }} title="Download this chat as Markdown">
                <Download size={13} /> Export
              </button>
            </div>
          )}

          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              <div className="w-full max-w-2xl text-center">
                {chats.length > 0 && (
                  <button onClick={() => setSidebarOpen(true)} className="mb-6 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs md:hidden" style={{ border: "1px solid var(--border-hairline)", color: "var(--text-muted)" }}>
                    <Menu size={14} /> Chat history
                  </button>
                )}
                <div className="font-[family-name:var(--font-script)] text-2xl" style={{ color: "var(--ev-red)" }}>{g.np}</div>
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
                      <s.icon size={18} className="flex-none" style={{ color: "var(--text-muted)" }} /> {s.text}
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
              <div
                ref={scrollBoxRef}
                onScroll={() => {
                  const el = scrollBoxRef.current;
                  if (el) stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                }}
                className="sathi-scroll min-h-0 flex-1 overflow-y-auto"
              >
                <div className="mx-auto w-full max-w-3xl px-6 py-8">
                  <div className="space-y-8">
                    {messages.map((m, i) =>
                      m.role === "user" ? (
                        <div key={i} className="group flex flex-col items-end gap-2">
                          {m.images?.map((src, xi) => (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img key={xi} src={src} alt="sent" className="max-h-48 max-w-[60%] rounded-xl object-contain" style={{ border: "1px solid var(--border-strong)" }} />
                          ))}
                          {m.attachments?.map((d, xi) => (
                            <div key={xi} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs" style={{ background: "var(--surface-inset)", border: "1px solid var(--border-hairline)" }}>
                              <FileText size={14} aria-hidden />
                              <span className="max-w-[200px] truncate" style={{ color: "var(--text-body)" }}>{d.name}</span>
                              {d.pages > 0 && <span style={{ color: "var(--text-faint)" }}>{d.pages}p</span>}
                              {d.url && <button onClick={() => setArtifact({ id: `pdf-m-${xi}`, title: d.name, kind: "pdf", lang: "pdf", code: d.url! })} className="font-semibold" style={{ color: "var(--ev-red)" }}>View</button>}
                            </div>
                          ))}
                          {editingIdx === i ? (
                            <div className="w-full max-w-[85%]">
                              <textarea
                                autoFocus
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(); } if (e.key === "Escape") setEditingIdx(null); }}
                                rows={3}
                                className="w-full resize-none rounded-xl p-3 text-[15px] outline-none"
                                style={{ background: "var(--ev-white-05)", border: "1px solid var(--border-accent)", color: "var(--text-strong)" }}
                              />
                              <div className="mt-1.5 flex justify-end gap-3 text-xs">
                                <button onClick={() => setEditingIdx(null)} className="font-semibold" style={{ color: "var(--text-muted)" }}>Cancel</button>
                                <button onClick={submitEdit} className="font-semibold" style={{ color: "var(--ev-red)" }}>Save &amp; resend</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="max-w-[80%] px-4 py-3 text-[15px] leading-relaxed" style={{ background: "var(--ev-white-05)", border: "1px solid var(--border-hairline)", borderRadius: "16px 16px 4px 16px" }}>
                                <Content text={m.content} />
                              </div>
                              {!busy && (
                                <button
                                  onClick={() => { setEditingIdx(i); setEditText(m.content); }}
                                  className="flex items-center gap-1 text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100"
                                  style={{ color: "var(--text-faint)" }}
                                  title="Edit this message and re-run from here"
                                >
                                  <Pencil size={11} /> edit
                                </button>
                              )}
                            </>
                          )}
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
                            {m.video ? (
                              <div className="mb-2">
                                <video
                                  src={m.video}
                                  controls
                                  loop
                                  playsInline
                                  className="max-h-96 max-w-full rounded-xl"
                                  style={{ border: "1px solid var(--border-strong)" }}
                                />
                                <a
                                  href={m.video}
                                  download={`aisathi-video-${i}.mp4`}
                                  className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold"
                                  style={{ color: "var(--ev-red)" }}
                                >
                                  <Download size={12} /> Download video
                                </a>
                              </div>
                            ) : null}
                            <div className="text-[15px] leading-relaxed">
                              <Content text={m.content} onArtifact={setArtifact} />
                              {busy && i === messages.length - 1 && (
                                <span className="ml-1 inline-block h-4 w-2 animate-pulse align-text-bottom" style={{ background: "var(--text-muted)" }} />
                              )}
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-[11px]" style={{ color: "var(--text-faint)" }}>
                              {m.costNpr != null && <span>{m.costNpr === 0 ? "free" : `${fmtCredits(m.costNpr)} credits`} · {modelLabel(m.model ?? model)}</span>}
                              {m.doc && !busy && (
                                <button
                                  onClick={() => downloadPdf(chat?.title ?? "document", m.content)}
                                  className="flex items-center gap-1 font-semibold"
                                  style={{ color: "var(--ev-red)" }}
                                >
                                  <Download size={12} /> Download PDF
                                </button>
                              )}
                              {!busy && (
                                <span className={`flex items-center gap-3 transition-opacity ${voted[`${chat?.id}:${i}`] ? "" : "opacity-0 group-hover:opacity-100"}`}>
                                  <button
                                    onClick={() => sendFeedback(i, "up")}
                                    disabled={!!voted[`${chat?.id}:${i}`]}
                                    title="Good reply — enters the रू1,000 lucky draw"
                                    className="flex items-center font-semibold hover:text-white disabled:cursor-default"
                                    style={voted[`${chat?.id}:${i}`] === "up" ? { color: "#4ade80" } : undefined}
                                  >
                                    <ThumbsUp size={12} fill={voted[`${chat?.id}:${i}`] === "up" ? "currentColor" : "none"} />
                                  </button>
                                  <button
                                    onClick={() => sendFeedback(i, "down")}
                                    disabled={!!voted[`${chat?.id}:${i}`]}
                                    title="Bad reply — helps us improve"
                                    className="flex items-center font-semibold hover:text-white disabled:cursor-default"
                                    style={voted[`${chat?.id}:${i}`] === "down" ? { color: "var(--ev-red)" } : undefined}
                                  >
                                    <ThumbsDown size={12} fill={voted[`${chat?.id}:${i}`] === "down" ? "currentColor" : "none"} />
                                  </button>
                                  {voted[`${chat?.id}:${i}`] && (
                                    <span className="text-[10px]" style={{ color: "var(--text-faint)" }}>
                                      {session ? "thanks — you're in this month's draw" : "thanks!"}
                                    </span>
                                  )}
                                  <button onClick={() => copyMessage(i, m.content)} className="flex items-center gap-1 font-semibold hover:text-white">
                                    {copiedIdx === i ? <Check size={12} /> : <Copy size={12} />} {copiedIdx === i ? "copied" : "copy"}
                                  </button>
                                  {i === messages.length - 1 && (
                                    <button onClick={regenerate} className="flex items-center gap-1 font-semibold hover:text-white"><RotateCcw size={12} /> regenerate</button>
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
                    {/* Suggested follow-up questions after the latest reply. */}
                    {!busy && followups.length > 0 && messages[messages.length - 1]?.role === "assistant" && (
                      <div className="ml-11 flex flex-col items-start gap-1.5 pt-1">
                        {followups.map((f, fi) => (
                          <button
                            key={fi}
                            onClick={() => send(f)}
                            className="rounded-full px-3.5 py-1.5 text-left text-[13px] transition-colors hover:bg-white/5"
                            style={{ border: "1px solid var(--border-hairline)", color: "var(--text-body)" }}
                          >
                            {f}
                          </button>
                        ))}
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

        {/* Artifact side panel (desktop) — live preview of generated HTML/SVG/code. */}
        {artifact && (
          <aside className="hidden w-[46%] max-w-3xl flex-none md:block" style={{ borderLeft: "1px solid var(--border-hairline)" }}>
            <ArtifactPanel art={artifact} onClose={() => setArtifact(null)} />
          </aside>
        )}
      </div>

      {/* Artifact overlay (mobile) */}
      {artifact && (
        <div className="fixed inset-0 z-50 md:hidden">
          <ArtifactPanel art={artifact} onClose={() => setArtifact(null)} />
        </div>
      )}
    </div>
  );
}
