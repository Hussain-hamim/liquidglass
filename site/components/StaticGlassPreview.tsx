"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { GlassPreset } from "@/lib/presets";
import { useInView } from "@/lib/useInView";
import { useFloatingGlassDrift } from "@/lib/useFloatingGlassDrift";
import { acquireGlassSlot, releaseGlassSlot } from "@/lib/glassBudget";
import { isWebGLSupported } from "@/lib/webglSupport";
import { usePrefersReducedTransparency } from "@/lib/usePrefersReducedTransparency";

type ActionBarProps = {
  onPreview: () => void;
  onCopy: () => void;
  mobileOpen: boolean;
};

export function StaticGlassPreview({
  preset,
  actionBar,
  configOverride,
  previewMode = "card",
  paused = false,
}: {
  preset: GlassPreset;
  actionBar?: ActionBarProps;
  configOverride?: Record<string, unknown>;
  previewMode?: "card" | "modal";
  /** When true, skip WebGL (e.g. while the modal preview is open). */
  paused?: boolean;
}) {
  const { ref: rootRef, inView } = useInView("200px");
  const glassRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<{ destroy: () => void; markChanged?: (element?: HTMLElement) => void } | null>(null);
  const slotAcquiredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  const reducedTransparency = usePrefersReducedTransparency();
  const isModal = previewMode === "modal";
  const width = preset.width ?? 120;
  const height = preset.height ?? 68;
  const label = preset.label ?? preset.name;
  const bg = preset.background ?? "/backgrounds/background-1.avif";

  const effectiveConfig = useMemo((): Record<string, unknown> => {
    const merged = configOverride
      ? { ...preset.config, ...configOverride }
      : { ...preset.config };
    return {
      ...merged,
      floating: (merged.floating as boolean | undefined) ?? true,
    };
  }, [preset.config, preset.id, configOverride]);

  const floatingEnabled = Boolean(effectiveConfig.floating);

  const configJson = useMemo(
    () => JSON.stringify(effectiveConfig),
    [effectiveConfig],
  );

  const configJsonRef = useRef(configJson);
  configJsonRef.current = configJson;

  useEffect(() => {
    const shouldMount = !paused && (isModal || inView);
    if (!shouldMount) {
      setReady(false);
      if (glassRef.current) {
        glassRef.current.style.transform = "";
        glassRef.current.style.cursor = "";
      }
      return;
    }

    const root = rootRef.current;
    const glass = glassRef.current;
    if (!root || !glass) return;

    if (reducedTransparency || !isWebGLSupported() || !acquireGlassSlot()) {
      setFallback(true);
      setReady(true);
      return;
    }

    slotAcquiredRef.current = true;
    let instance: { destroy: () => void; markChanged?: (element?: HTMLElement) => void } | undefined;
    let cancelled = false;
    setFallback(false);

    (async () => {
      try {
        const { LiquidGlass } = await import("@ybouane/liquidglass");
        if (cancelled) return;

        glass.dataset.config = configJsonRef.current;
        instance = await LiquidGlass.init({
          root,
          glassElements: [glass],
        });
        instanceRef.current = instance;
        if (cancelled) {
          instance?.destroy();
          instanceRef.current = null;
        } else {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setFallback(true);
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      instance?.destroy();
      instanceRef.current = null;
      if (slotAcquiredRef.current) {
        releaseGlassSlot();
        slotAcquiredRef.current = false;
      }
      setReady(false);
    };
  }, [inView, isModal, reducedTransparency, paused]);

  useEffect(() => {
    if (!ready || fallback || !glassRef.current || !instanceRef.current) return;
    glassRef.current.dataset.config = configJson;
    instanceRef.current.markChanged?.(glassRef.current);
  }, [configJson, ready, fallback]);

  useFloatingGlassDrift({
    enabled: ready && !fallback && inView && !isModal && !paused && !floatingEnabled,
    rootRef,
    glassRef,
    instanceRef,
    width,
    height,
  });

  const showStaticPlaceholder = paused && !isModal;

  return (
    <div ref={rootRef} className="relative w-full h-full overflow-hidden">
      <img
        src={bg}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div
        ref={glassRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center transition-opacity duration-300"
        style={{
          width,
          height,
          opacity: showStaticPlaceholder || ready ? 1 : 0,
          ...(showStaticPlaceholder || fallback
            ? reducedTransparency
              ? {
                  background: "rgb(38,38,42)",
                  borderRadius: Number(effectiveConfig.cornerRadius ?? 32),
                  border: "1px solid rgba(255,255,255,0.16)",
                }
              : {
                  background: "rgba(255,255,255,0.12)",
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                  borderRadius: Number(effectiveConfig.cornerRadius ?? 32),
                  border: "1px solid rgba(255,255,255,0.2)",
                }
            : {}),
        }}
      >
        {label && (
          <span
            className="relative z-[2] text-white font-semibold text-sm pointer-events-none"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            {label}
          </span>
        )}
      </div>

      {actionBar && (
        <div
          className={`absolute inset-x-0 bottom-0 z-10 transition-transform duration-200 ease-out ${
            actionBar.mobileOpen
              ? "translate-y-0"
              : "translate-y-full group-hover:translate-y-0"
          }`}
        >
          <div className="bg-zinc-950/92 backdrop-blur-md border-t border-white/[0.06] px-3 py-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-zinc-100 text-xs font-semibold truncate">
                {preset.name}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                actionBar.onPreview();
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
                actionBar.onCopy();
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
  );
}
