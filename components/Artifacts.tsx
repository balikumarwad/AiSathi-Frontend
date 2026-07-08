"use client";

import { useState } from "react";
import { ArrowUpRight, Check, Copy, Download, FileText, Globe, Image as ImageIcon, X } from "lucide-react";

/**
 * Artifacts — Claude-style live previews. When the model emits a substantial
 * standalone block (HTML page, SVG image, or a long code snippet), it renders
 * as a compact card in the chat that opens a side panel with a live preview
 * (sandboxed iframe) and a Preview/Code toggle, plus copy and download.
 */

// "pdf" artifacts carry a data URL in `code` and render in a native viewer.
export type Artifact = { id: string; title: string; kind: "html" | "svg" | "code" | "pdf"; lang: string; code: string };

function hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36).slice(0, 8);
}

/** Decide whether a fenced code block is worth promoting to an artifact. */
export function classifyArtifact(lang: string, code: string): Artifact | null {
  const l = (lang || "").toLowerCase();
  const trimmed = code.trim();
  if (!trimmed) return null;
  const lines = trimmed.split("\n").length;
  let kind: Artifact["kind"] | null = null;
  let title = "";
  if (l === "html" || /^<!doctype html|^<html[\s>]/i.test(trimmed)) { kind = "html"; title = "Web page"; }
  else if (l === "svg" || /^<svg[\s>]/i.test(trimmed)) { kind = "svg"; title = "SVG image"; }
  else if (lines >= 15) { kind = "code"; title = `${l || "code"} snippet`; }
  if (!kind) return null;
  return { id: hash(trimmed), title, kind, lang: l, code: trimmed };
}

export function extractArtifacts(text: string): Artifact[] {
  const parts = text.split("```");
  const out: Artifact[] = [];
  for (let i = 1; i < parts.length; i += 2) {
    const seg = parts[i];
    const lang = seg.match(/^([a-z0-9+-]+)\n/i)?.[1] ?? "";
    const body = seg.replace(/^[a-z0-9+-]*\n/i, "");
    const a = classifyArtifact(lang, body);
    if (a) out.push(a);
  }
  return out;
}

export function ArtifactCard({ art, onOpen }: { art: Artifact; onOpen: () => void }) {
  const Icon = art.kind === "html" ? Globe : art.kind === "svg" ? ImageIcon : FileText;
  return (
    <button
      onClick={onOpen}
      className="my-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-white/5"
      style={{ border: "1px solid var(--border-strong)", background: "var(--surface-inset)" }}
    >
      <Icon size={20} style={{ color: "var(--text-muted)" }} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{art.title}</span>
        <span className="block text-[11px]" style={{ color: "var(--text-faint)" }}>{art.code.split("\n").length} lines · click to open</span>
      </span>
      <span className="flex flex-none items-center gap-1 text-xs font-semibold" style={{ color: "var(--ev-red)" }}>Open <ArrowUpRight size={14} /></span>
    </button>
  );
}

export function ArtifactPanel({ art, onClose }: { art: Artifact; onClose: () => void }) {
  const isPdf = art.kind === "pdf";
  const runnableJs = art.kind === "code" && /^(js|javascript|mjs|jsx|node)$/i.test(art.lang);
  const canPreview = art.kind === "html" || art.kind === "svg" || isPdf || runnableJs;
  const hasCode = !isPdf;
  const [tab, setTab] = useState<"preview" | "code">(canPreview ? "preview" : "code");
  const [copied, setCopied] = useState(false);

  const download = () => {
    const a = document.createElement("a");
    if (isPdf) {
      a.href = art.code; // data URL
      a.download = `${art.title || "document"}.pdf`;
      a.click();
      return;
    }
    const ext = art.kind === "html" ? "html" : art.kind === "svg" ? "svg" : (art.lang || "txt");
    const blob = new Blob([art.code], { type: "text/plain" });
    a.href = URL.createObjectURL(blob);
    a.download = `aisathi-artifact.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // SVG is wrapped in a minimal HTML doc so it centers on a white ground.
  const htmlDoc = art.kind === "svg"
    ? `<!doctype html><html><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#fff">${art.code}</body></html>`
    : art.code;

  // JS runner: sandboxed iframe that captures console output into its own body.
  const runnerDoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;color:#e8edf6;background:#0d0d0d;margin:0;padding:14px;line-height:1.6;white-space:pre-wrap;word-break:break-word}
    .err{color:#ff6b6b}.warn{color:#f0b429}.dim{color:#8a94a6}
  </style></head><body><script>
    function fmt(x){try{return typeof x==='object'?JSON.stringify(x,null,2):String(x)}catch(e){return String(x)}}
    function out(cls,args){var d=document.createElement('div');if(cls)d.className=cls;d.textContent=[].map.call(args,fmt).join(' ');document.body.appendChild(d)}
    ['log','info'].forEach(function(k){var o=console[k];console[k]=function(){out('',arguments);o.apply(console,arguments)}});
    var W=console.warn;console.warn=function(){out('warn',arguments);W.apply(console,arguments)};
    var E=console.error;console.error=function(){out('err',arguments);E.apply(console,arguments)};
    window.onerror=function(m,s,l,c,e){out('err',[e&&e.stack||m]);return true};
    try{
${art.code.replace(/<\/script>/gi, "<\\/script>")}
    }catch(e){out('err',[e&&e.stack||String(e)])}
    if(!document.body.children.length){out('dim',['(ran with no console output)'])}
  <\/script></body></html>`;

  const previewDoc = runnableJs ? runnerDoc : htmlDoc;

  const tabBtn = (id: "preview" | "code", label: string) => (
    <button
      onClick={() => setTab(id)}
      className="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
      style={tab === id
        ? { background: "var(--ev-white-10)", color: "var(--text-strong)" }
        : { color: "var(--text-muted)" }}
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full flex-col" style={{ background: "#0d0d0d" }}>
      <header className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid var(--border-hairline)" }}>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: "var(--text-strong)" }}>{art.title}</span>
        {canPreview && hasCode && (
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ border: "1px solid var(--border-hairline)" }}>
            {tabBtn("preview", runnableJs ? "Run" : "Preview")}
            {tabBtn("code", "Code")}
          </div>
        )}
        {hasCode && (
          <button
            onClick={() => { navigator.clipboard.writeText(art.code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="flex items-center rounded-md px-2 py-1.5 transition-colors hover:bg-white/5"
            style={{ color: "var(--text-muted)" }}
            title="Copy"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        )}
        <button onClick={download} className="flex items-center rounded-md px-2 py-1.5 transition-colors hover:bg-white/5" style={{ color: "var(--text-muted)" }} title="Download">
          <Download size={15} />
        </button>
        <button onClick={onClose} className="flex items-center rounded-md px-2 py-1.5 transition-colors hover:bg-white/5" style={{ color: "var(--text-faint)" }} title="Close"><X size={15} /></button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">
        {isPdf ? (
          <iframe src={art.code} className="h-full w-full border-0 bg-white" title={art.title} />
        ) : tab === "preview" && canPreview ? (
          <iframe
            key={art.id + tab}
            sandbox="allow-scripts allow-popups allow-forms"
            srcDoc={previewDoc}
            className="h-full w-full border-0"
            style={{ background: runnableJs ? "#0d0d0d" : "#fff" }}
            title={art.title}
          />
        ) : (
          <pre className="h-full overflow-auto p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed" style={{ color: "var(--text-body)" }}>
            {art.code}
          </pre>
        )}
      </div>
    </div>
  );
}
