"use client";

import { useCallback, useState } from "react";

interface CodeBlockProps {
  language: "json" | "bash" | "javascript" | "text";
  label?: string;
  code: string;
  testid?: string;
}

const LANGUAGE_LABEL: Record<CodeBlockProps["language"], string> = {
  json: "JSON",
  bash: "BASH",
  javascript: "JS",
  text: "TEXT",
};

export function CodeBlock({ language, label, code, testid }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(code)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      })
      .catch(() => undefined);
  }, [code]);

  return (
    <div
      data-testid={testid}
      className="overflow-hidden rounded-md border border-zinc-900 bg-black"
    >
      <div className="flex items-center justify-between border-b border-zinc-900 bg-zinc-950 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
          {label ?? LANGUAGE_LABEL[language]}
        </span>
        <button
          type="button"
          onClick={onCopy}
          data-testid={testid ? `${testid}-copy` : undefined}
          aria-label="Copy code"
          className="rounded border border-zinc-800 bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-emerald-500/40 hover:text-emerald-200"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-x-auto px-3 py-2 font-mono text-[12px] leading-relaxed text-zinc-200"
        style={{ fontFamily: "var(--app-font-mono)" }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}
