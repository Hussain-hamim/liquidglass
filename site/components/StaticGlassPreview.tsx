"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { GlassPreset } from "@/lib/presets";
import { useInView } from "@/lib/useInView";
import { useFloatingGlassDrift } from "@/lib/useFloatingGlassDrift";
import { isWebGLSupported } from "@/lib/webglSupport";

type ActionBarProps = {
  onPreview: () => void;
  onCopy: () => void;
  mobileOpen: boolean;
};

export function StaticGlassPreview({
  preset,
  actionBar,
}: {
  preset: GlassPreset;
  actionBar?: ActionBarProps;
}) {
  const { ref: rootRef, inView } = useInView("200px");
  const glassRef = useRef<HTMLDivElement>(null);
  const barGlassRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<{ destroy: () => void; markChanged?: (element?: HTMLElement) => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  const width = preset.width ?? 120;
  const height = preset.height ?? 68;
  const label = preset.label ?? preset.name;
  const bg = preset.background ?? "/backgrounds/background-1.avif";

  const configJson = useMemo(
    () => JSON.stringify({ ...preset.config, floating: true }),
    [preset.id]
  );

  const barConfigJson = useMemo(
    () =>
      JSON.stringify({
        ...preset.config,
        floating: false,
        cornerRadius: 0,
      }),
    [preset.id]
  );

  useEffect(() => {
    if (!inView) {
      setReady(false);
      return;
    }

    const root = rootRef.current;
    const glass = glassRef.current;
    if (!root || !glass) return;

    if (!isWebGLSupported()) {
      setFallback(true);
      setReady(true);
      return;
    }

    let instance: { destroy: () => void; markChanged?: (element?: HTMLElement) => void } | undefined;
    let cancelled = false;
    setFallback(false);

    (async () => {
      try {
        const { LiquidGlass } = await import("@ybouane/liquidglass");
        if (cancelled) return;

        glass.dataset.config = configJson;
        const glassElements: HTMLDivElement[] = [glass];

        const bar = barGlassRef.current;
        if (actionBar && bar) {
          bar.dataset.config = barConfigJson;
          glassElements.push(bar);
        }

        instance = await LiquidGlass.init({
          root,
          glassElements,
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
      setReady(false);
    };
  }, [inView, configJson, barConfigJson, Boolean(actionBar)]);

  useEffect(() => {
    if (!actionBar || !ready || fallback) return;
    const root = rootRef.current;
    const bar = barGlassRef.current;
    if (!root || !bar) return;

    const markBar = () => instanceRef.current?.markChanged?.(bar);
    root.addEventListener("mouseenter", markBar);
    bar.addEventListener("transitionrun", markBar);
    bar.addEventListener("transitionend", markBar);
    return () => {
      root.removeEventListener("mouseenter", markBar);
      bar.removeEventListener("transitionrun", markBar);
      bar.removeEventListener("transitionend", markBar);
    };
  }, [actionBar, ready, fallback, actionBar?.mobileOpen]);

  useFloatingGlassDrift({
    enabled: ready && !fallback && inView,
    rootRef,
    glassRef,
    instanceRef,
    width,
    height,
  });

  const barFallbackStyle = fallback
    ? {
        background: "rgba(255,255,255,0.12)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.2)",
      }
    : {};

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
          opacity: ready ? 1 : 0,
          ...(fallback
            ? {
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
                borderRadius: Number(preset.config.cornerRadius ?? 32),
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
          ref={barGlassRef}
          className={`absolute inset-x-0 bottom-0 z-10 transition-transform duration-200 ease-out ${
            actionBar.mobileOpen
              ? "translate-y-0"
              : "translate-y-full group-hover:translate-y-0"
          }`}
          style={{
            opacity: ready ? 1 : 0,
            ...barFallbackStyle,
          }}
        >
          <div className="relative z-[2] px-3 py-2.5 flex items-center gap-2">
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
                actionBar.onCopy();
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
  );
}
