"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { GlassPreset } from "@/lib/presets";
import { useInView } from "@/lib/useInView";
import { isWebGLSupported } from "@/lib/webglSupport";

export function StaticGlassPreview({ preset }: { preset: GlassPreset }) {
  const { ref: rootRef, inView } = useInView("200px");
  const glassRef = useRef<HTMLDivElement>(null);
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

    let instance: { destroy: () => void } | undefined;
    let cancelled = false;
    setFallback(false);

    (async () => {
      try {
        const { LiquidGlass } = await import("@ybouane/liquidglass");
        if (cancelled) return;

        glass.dataset.config = configJson;
        instance = await LiquidGlass.init({
          root,
          glassElements: [glass],
        });
        if (cancelled) {
          instance?.destroy();
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
      setReady(false);
    };
  }, [inView, configJson]);

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
    </div>
  );
}
