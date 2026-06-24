"use client";

import { useEffect, useRef, useState } from "react";
import type { GlassPreset } from "@/lib/presets";
import { generateComponentCode, getInstallCommand } from "@/lib/generateCode";
import { useInView } from "@/lib/useInView";
import { GlassPreview } from "./GlassPreview";
import { StaticGlassPreview } from "./StaticGlassPreview";

export function PresetCard({
  preset,
  onCopy,
}: {
  preset: GlassPreset;
  onCopy: (message: string) => void;
}) {
  const { ref: cardRef, inView } = useInView("250px");
  const [showPreview, setShowPreview] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const installCmd = getInstallCommand(preset);

  const handleCopy = async () => {
    const code = generateComponentCode(preset);
    await navigator.clipboard.writeText(code);
    onCopy("Copied to clipboard!");
  };

  const copyInstall = async () => {
    await navigator.clipboard.writeText(installCmd);
    onCopy("Copied install command!");
  };

  useEffect(() => {
    if (!showPreview) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowPreview(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [showPreview]);

  return (
    <>
      <div
        ref={cardRef}
        className="group relative rounded-2xl overflow-hidden aspect-square bg-zinc-900/30 border border-white/[0.06] hover:border-white/[0.12] transition-colors"
        onClick={() => {
          if (window.matchMedia("(hover: none)").matches) {
            setMobileOpen((v) => !v);
          }
        }}
      >
        {inView || showPreview ? (
          preset.interactive ? (
            <GlassPreview preset={preset} />
          ) : (
            <StaticGlassPreview
              preset={preset}
              actionBar={{
                onPreview: () => setShowPreview(true),
                onCopy: handleCopy,
                mobileOpen,
              }}
            />
          )
        ) : (
          <div className="absolute inset-0 bg-zinc-900/50 animate-pulse" />
        )}

        {preset.interactive && (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 transition-transform duration-200 ease-out ${
            mobileOpen
              ? "translate-y-0"
              : "translate-y-full group-hover:translate-y-0"
          }`}
        >
          <div className="bg-black/60 backdrop-blur-md border-t border-white/[0.08] px-3 py-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-zinc-100 text-xs font-semibold truncate">
                {preset.name}
              </p>
              <span className="text-[10px] text-zinc-500">Interactive</span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPreview(true);
              }}
              className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors"
              title="Preview"
              aria-label={`Preview ${preset.name}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-200 transition-colors"
              title="Copy code"
              aria-label={`Copy code for ${preset.name}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
        )}
      </div>

      {showPreview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowPreview(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`preview-title-${preset.id}`}
            className={`relative w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md ${
              preset.interactive === "play" || preset.interactive === "media-bar"
                ? "aspect-video max-w-2xl"
                : "aspect-square max-w-lg"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <span id={`preview-title-${preset.id}`} className="sr-only">
              Preview: {preset.name}
            </span>
            <GlassPreview preset={preset} />

            <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/60 border border-white/[0.08] backdrop-blur-sm">
                <code className="text-[11px] text-zinc-300 font-mono">{installCmd}</code>
                <button
                  onClick={copyInstall}
                  className="p-0.5 rounded text-zinc-500 hover:text-zinc-300 transition-colors"
                  title="Copy install command"
                  aria-label="Copy install command"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-zinc-950 text-sm font-medium hover:bg-zinc-100 transition-colors"
              >
                Copy Code
              </button>
              <button
                ref={closeButtonRef}
                onClick={() => setShowPreview(false)}
                className="px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-100 text-sm font-medium hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
