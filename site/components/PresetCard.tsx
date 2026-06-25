"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { GlassPreset } from "@/lib/presets";
import { generateComponentCode } from "@/lib/generateCode";
import { useInView } from "@/lib/useInView";
import { GlassPreview } from "./GlassPreview";
import { StaticGlassPreview } from "./StaticGlassPreview";
import { PresetModal } from "./PresetModal";

export function PresetCard({
  preset,
  onCopy,
  forceOpen,
  onOpenChange,
  revealIndex = 0,
}: {
  preset: GlassPreset;
  onCopy: (message: string) => void;
  forceOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  revealIndex?: number;
}) {
  const { ref: cardRef, inView } = useInView("250px");
  const [showPreview, setShowPreview] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);

  const open = showPreview || Boolean(forceOpen);

  const setOpen = (next: boolean) => {
    setShowPreview(next);
    onOpenChange?.(next);
    if (!next) previewTriggerRef.current?.focus({ preventScroll: true });
  };

  const handleCopy = async () => {
    const code = generateComponentCode(preset);
    await navigator.clipboard.writeText(code);
    onCopy("Copied to clipboard!");
  };

  useEffect(() => {
    if (forceOpen) setShowPreview(true);
  }, [forceOpen]);

  return (
    <>
      <div
        id={`preset-${preset.id}`}
        ref={cardRef}
        className="group glass-card glass-card-enter relative rounded-2xl overflow-hidden aspect-square bg-zinc-900/30 border border-white/[0.06] hover:border-white/[0.12] scroll-mt-24 motion-reduce:transform-none"
        style={{ "--reveal-delay": `${Math.min(revealIndex, 12) * 35}ms` } as CSSProperties}
        onClick={() => {
          if (window.matchMedia("(hover: none)").matches) {
            setMobileOpen((v) => !v);
          }
        }}
      >
        {inView || open ? (
          preset.interactive || preset.category === "notifications" ? (
            <GlassPreview
              preset={preset}
              paused={open}
              actionBar={
                preset.interactive
                  ? undefined
                  : {
                      onPreview: () => setOpen(true),
                      onCopy: handleCopy,
                      mobileOpen,
                    }
              }
            />
          ) : (
            <StaticGlassPreview
              preset={preset}
              paused={open}
              actionBar={{
                onPreview: () => setOpen(true),
                onCopy: handleCopy,
                mobileOpen,
              }}
            />
          )
        ) : (
          <div className="absolute inset-0 bg-zinc-900/50 animate-pulse motion-reduce:animate-none" />
        )}

        {preset.interactive && (
          <div
            className={`absolute inset-x-0 bottom-0 z-10 transition-transform duration-200 ease-out ${
              mobileOpen
                ? "translate-y-0"
                : "translate-y-full group-hover:translate-y-0"
            }`}
          >
            <div className="bg-zinc-950/92 backdrop-blur-md border-t border-white/[0.06] px-3 py-2.5 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-zinc-100 text-xs font-semibold truncate">
                  {preset.name}
                </p>
                <span className="text-[10px] text-zinc-500">Interactive</span>
              </div>
              <button
                ref={previewTriggerRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(true);
                }}
                className="shrink-0 p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 transition-colors"
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
                className="shrink-0 p-2 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-zinc-200 transition-colors"
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

      <PresetModal
        preset={preset}
        open={open}
        onClose={() => setOpen(false)}
        onCopy={onCopy}
      />
    </>
  );
}
