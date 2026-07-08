"use client";

import { Fragment, useState } from "react";
import { ArtifactCard, classifyArtifact, type Artifact } from "@/components/Artifacts";

/**
 * Markdown-lite renderer (no deps, no raw HTML) shared by the playground and
 * the public /share pages so a conversation renders identically in both.
 * Supports: `code`, **bold**, *italic*, [label](url), #-headings, -/1. lists,
 * and ``` fenced code blocks with a copy button.
 */

function Inline({ text }: { text: string }) {
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
        const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
        if (h && lines.length === 1) {
          const size = ["text-xl font-bold", "text-lg font-bold", "text-base font-bold", "text-[15px] font-semibold"][h[1].length - 1];
          return <div key={bi} className={`mb-2 mt-4 ${size}`}><Inline text={h[2]} /></div>;
        }
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
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-b-md p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed" style={{ background: "rgba(0,0,0,0.55)", border: "1px solid var(--border-hairline)", borderTop: "none" }}>
        {body}
      </pre>
    </div>
  );
}

export default function Content({ text, onArtifact }: { text: string; onArtifact?: (a: Artifact) => void }) {
  const parts = text.split("```");
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return part.trim() ? <Prose key={i} text={part} /> : null;
        // Fenced code: promote substantial HTML/SVG/long code to an artifact
        // card when a handler is provided (the playground); otherwise show code.
        if (onArtifact) {
          const lang = part.match(/^([a-z0-9+-]+)\n/i)?.[1] ?? "";
          const body = part.replace(/^[a-z0-9+-]*\n/i, "");
          const art = classifyArtifact(lang, body);
          if (art) return <ArtifactCard key={i} art={art} onOpen={() => onArtifact(art)} />;
        }
        return <CodeBlock key={i} code={part} />;
      })}
    </>
  );
}
