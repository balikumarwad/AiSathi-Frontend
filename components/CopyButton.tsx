"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Small copy-to-clipboard button with "Copied!" feedback (audit item 14). */
export default function CopyButton({ text, label = "Copy code" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <button
      onClick={() => {
        setFailed(false);
        if (!navigator.clipboard) { setFailed(true); return; }
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1600);
        }).catch(() => setFailed(true));
      }}
      className="absolute right-3 top-3 rounded-md border border-zinc-700 bg-zinc-900/80 px-2.5 py-1 text-xs font-semibold text-zinc-300 backdrop-blur transition hover:border-zinc-500 hover:text-white"
      aria-label={label}
    >
      <span className="flex items-center gap-1.5">
        {copied ? <Check size={13} /> : <Copy size={13} />}
        <span role="status">{failed ? "Select & copy manually" : copied ? "Copied!" : "Copy"}</span>
      </span>
    </button>
  );
}
