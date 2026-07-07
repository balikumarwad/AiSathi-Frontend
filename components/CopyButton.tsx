"use client";

import { useState } from "react";

/** Small copy-to-clipboard button with "Copied!" feedback (audit item 14). */
export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      className="absolute right-3 top-3 rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-xs font-semibold text-zinc-300 backdrop-blur transition hover:border-zinc-500 hover:text-white"
      aria-label="Copy code"
    >
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}
