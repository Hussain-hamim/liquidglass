"use client";

import { useState } from "react";
import { Highlight, themes } from "prism-react-renderer";

export function CodeBlock({
  code,
  language = "tsx",
  filename,
  onCopy,
}: {
  code: string;
  language?: string;
  filename?: string;
  onCopy?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    onCopy?.();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-white/[0.08] overflow-hidden bg-zinc-950/80">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06] bg-zinc-900/60">
        <div className="flex items-center gap-2 min-w-0">
          {filename && (
            <span className="text-[11px] font-mono text-zinc-500 truncate">{filename}</span>
          )}
          <span className="text-[10px] uppercase tracking-wide text-zinc-600">{language}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 px-2 py-1 rounded-md text-[11px] font-medium text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <Highlight theme={themes.nightOwl} code={code.trim()} language={language}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={`${className} overflow-x-auto p-4 text-[11px] leading-relaxed max-h-[min(60vh,480px)]`}
            style={{ ...style, margin: 0, background: "transparent" }}
          >
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
