"use client";

import { Fragment, useState } from "react";
import { ArtifactCard, classifyArtifact, type Artifact } from "@/components/Artifacts";

/**
 * Markdown-lite renderer (no deps, no raw HTML) shared by the playground and
 * the public /share pages so a conversation renders identically in both.
 * Supports: `code`, **bold**, *italic*, ~~strike~~, [label](url), #-headings,
 * -/1. lists, > blockquotes, --- rules, | tables |, and ``` fenced code blocks
 * with a copy button. Styling aims for a clean, premium reading rhythm.
 */

function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
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
        if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="font-semibold" style={{ color: "var(--text-strong, #fff)" }}>{p.slice(2, -2)}</strong>;
        if (p.startsWith("~~") && p.endsWith("~~")) return <span key={i} className="line-through opacity-70">{p.slice(2, -2)}</span>;
        if (p.startsWith("*") && p.endsWith("*") && p.length > 2) return <em key={i}>{p.slice(1, -1)}</em>;
        const link = p.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
        if (link)
          return (
            <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="underline decoration-1 underline-offset-2 transition-opacity hover:opacity-80" style={{ color: "var(--ev-red)" }}>
              {link[1]}
            </a>
          );
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

/** Split a markdown table row into trimmed cells (tolerant of edge pipes). */
function rowCells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

/** A `|---|:--:|` style separator row — the signal that a block is a table. */
function isTableSep(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);
}

function Table({ lines }: { lines: string[] }) {
  const header = rowCells(lines[0]);
  const body = lines.slice(2).map(rowCells);
  return (
    <div className="my-4 overflow-x-auto rounded-lg" style={{ border: "1px solid var(--border-hairline)" }}>
      <table className="w-full border-collapse text-[14px]">
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
            {header.map((h, i) => (
              <th key={i} className="px-3.5 py-2.5 text-left font-semibold" style={{ borderBottom: "1px solid var(--border-strong)" }}>
                <Inline text={h} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 ? "rgba(255,255,255,0.02)" : "transparent" }}>
              {header.map((_, ci) => (
                <td key={ci} className="px-3.5 py-2.5 align-top" style={{ borderTop: "1px solid var(--border-hairline)" }}>
                  <Inline text={row[ci] ?? ""} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").filter((l) => l.length > 0);
        if (lines.length === 0) return null;

        // Horizontal rule
        if (lines.length === 1 && /^\s*([-*_])\1{2,}\s*$/.test(lines[0])) {
          return <hr key={bi} className="my-5 border-0 border-t" style={{ borderColor: "var(--border-hairline)" }} />;
        }

        // Heading
        const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
        if (h && lines.length === 1) {
          const level = h[1].length;
          const cls = [
            "text-[1.35rem] font-bold tracking-tight",
            "text-[1.15rem] font-bold tracking-tight",
            "text-[1rem] font-semibold",
            "text-[0.95rem] font-semibold",
          ][level - 1];
          const spacing = level <= 2 ? "mb-2.5 mt-6 first:mt-0" : "mb-1.5 mt-5 first:mt-0";
          return <div key={bi} className={`${spacing} ${cls}`}><Inline text={h[2]} /></div>;
        }

        // Blockquote
        if (lines.every((l) => /^\s*>\s?/.test(l))) {
          return (
            <blockquote key={bi} className="my-3.5 rounded-r py-1 pl-4 pr-2" style={{ borderLeft: "3px solid var(--ev-red)", background: "rgba(255,255,255,0.03)", color: "var(--text-muted)" }}>
              {lines.map((l, li) => (
                <Fragment key={li}>
                  {li > 0 && <br />}
                  <Inline text={l.replace(/^\s*>\s?/, "")} />
                </Fragment>
              ))}
            </blockquote>
          );
        }

        // Table
        if (lines.length >= 2 && lines[0].includes("|") && isTableSep(lines[1])) {
          return <Table key={bi} lines={lines} />;
        }

        // List (bulleted or numbered), with light support for indented sub-items
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={bi} className="my-2.5 space-y-2 pl-0.5">
              {lines.map((l, li) => {
                const indent = (l.match(/^(\s*)/)?.[1].length ?? 0) >= 2;
                const numbered = l.match(/^\s*(\d+)[.)]\s+(.*)$/);
                const bullet = l.match(/^\s*[-*•]\s+(.*)$/);
                return (
                  <li key={li} className={`flex gap-2.5 ${indent ? "ml-5" : ""}`}>
                    <span className="flex-none pt-px text-sm font-medium tabular-nums" style={{ color: "var(--ev-red)" }}>
                      {numbered ? `${numbered[1]}.` : indent ? "◦" : "•"}
                    </span>
                    <span className="min-w-0"><Inline text={numbered ? numbered[2] : bullet![1]} /></span>
                  </li>
                );
              })}
            </ul>
          );
        }

        // Paragraph
        return (
          <p key={bi} className="my-2.5 first:mt-0 last:mb-0">
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

/**
 * Zero-dependency syntax highlighter. One tokenizing pass (comments and
 * strings win over everything, so they can't be mis-split) classifies each
 * token; colors are fixed light-on-dark since the code surface is always dark.
 * Covers the common languages people paste — not a full grammar, but enough to
 * read cleanly. Falls back to plain text on very large blocks.
 */
const HL = {
  comment: "#8b949e",
  string: "#a5d6ff",
  number: "#79c0ff",
  keyword: "#ff7b72",
  literal: "#79c0ff",
  fn: "#d2a8ff",
};
const HL_KEYWORDS = new Set(
  "const let var function return if else for while do switch case break continue new class extends super import from export default async await try catch finally throw typeof instanceof void delete yield static get set public private protected def elif lambda pass with as not and or is print self package func type struct interface map range chan go defer fun val when object use pub impl trait where mut enum match crate mod ref then fi done elif local declare readonly echo select foreach namespace using".split(" "),
);
const HL_LITERALS = new Set("true false null undefined None True False nil NaN Infinity this self".split(" "));
// Languages whose line comments start with '#'; everything else uses // and /* */.
const HL_HASH = new Set("python py bash sh shell zsh yaml yml ruby rb r toml ini perl makefile dockerfile conf".split(" "));

const HL_STRING = /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/;
const HL_NUMBER = /\b0[xX][0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?\b/;
const HL_IDENT = /[A-Za-z_$][\w$]*/;

function highlight(code: string, lang: string): { s: string; c?: string; i?: boolean }[] {
  if (code.length > 20000) return [{ s: code }];
  const cmt = HL_HASH.has(lang.toLowerCase()) ? /#[^\n]*/ : /\/\/[^\n]*|\/\*[\s\S]*?\*\//;
  const re = new RegExp(`(${cmt.source})|(${HL_STRING.source})|(${HL_NUMBER.source})|(${HL_IDENT.source})|(\\s+|[\\s\\S])`, "g");
  const out: { s: string; c?: string; i?: boolean }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(code))) {
    if (m[1]) out.push({ s: m[1], c: HL.comment, i: true });
    else if (m[2]) out.push({ s: m[2], c: HL.string });
    else if (m[3]) out.push({ s: m[3], c: HL.number });
    else if (m[4]) {
      const w = m[4];
      if (HL_KEYWORDS.has(w)) out.push({ s: w, c: HL.keyword });
      else if (HL_LITERALS.has(w)) out.push({ s: w, c: HL.literal });
      else if (code[re.lastIndex] === "(") out.push({ s: w, c: HL.fn });
      else out.push({ s: w });
    } else out.push({ s: m[5] });
  }
  return out;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const lang = code.match(/^([a-z0-9+-]+)\n/i)?.[1] ?? "";
  const body = code.replace(/^[a-z0-9+-]*\n/i, "");
  const toks = highlight(body, lang);
  return (
    <div className="group/code relative my-3.5 overflow-hidden rounded-lg" style={{ border: "1px solid var(--border-hairline)" }}>
      <div className="flex items-center justify-between px-4 py-1.5 text-[11px]" style={{ background: "rgba(255,255,255,0.06)", color: "var(--text-faint)" }}>
        <span className="font-[family-name:var(--font-mono)] uppercase tracking-wide">{lang || "code"}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(body); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="font-semibold transition-colors hover:text-white"
        >
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 font-[family-name:var(--font-mono)] text-xs leading-relaxed" style={{ background: "rgba(0,0,0,0.55)", color: "#e6edf3" }}>
        {toks.map((t, i) => (t.c ? <span key={i} style={{ color: t.c, fontStyle: t.i ? "italic" : undefined }}>{t.s}</span> : <Fragment key={i}>{t.s}</Fragment>))}
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
