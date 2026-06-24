"use client";

import { useEffect, useLayoutEffect, useRef, useCallback, useState } from "react";
import { useInView } from "@/lib/useInView";
import { isWebGLSupported } from "@/lib/webglSupport";

const GLASS_CONFIG = {
  button: true,
  cornerRadius: 20,
  blurAmount: 0.25,
  brightness: -0.05,
};

const ACTIVE_GLASS_CONFIG = {
  button: true,
  cornerRadius: 20,
  blurAmount: 0.35,
  brightness: 0.1,
  edgeHighlight: 0.3,
};

export function GlassCategoryTabs({
  categories,
  active,
  onChange,
}: {
  categories: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  const { ref: rootRef, inView } = useInView("100px");
  const glassRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const instanceRef = useRef<{ destroy: () => void } | null>(null);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  const setGlassRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) glassRefs.current.set(id, el);
    else glassRefs.current.delete(id);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || !inView || glassRefs.current.size !== categories.length) {
      instanceRef.current?.destroy();
      instanceRef.current = null;
      setReady(false);
      return;
    }

    if (!isWebGLSupported()) {
      setFallback(true);
      setReady(true);
      return;
    }

    let cancelled = false;
    setFallback(false);

    const init = async () => {
      glassRefs.current.forEach((el, id) => {
        const config = id === active ? ACTIVE_GLASS_CONFIG : GLASS_CONFIG;
        el.dataset.config = JSON.stringify(config);
      });

      const elements = Array.from(glassRefs.current.values());
      try {
        const { LiquidGlass } = await import("@ybouane/liquidglass");
        if (cancelled) return;

        instanceRef.current?.destroy();
        instanceRef.current = await LiquidGlass.init({
          root,
          glassElements: elements,
        });

        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setFallback(true);
          setReady(true);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      instanceRef.current?.destroy();
      instanceRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length, inView]);

  useEffect(() => {
    glassRefs.current.forEach((el, id) => {
      const config = id === active ? ACTIVE_GLASS_CONFIG : GLASS_CONFIG;
      el.dataset.config = JSON.stringify(config);
    });
  }, [active]);

  return (
    <div
      ref={rootRef}
      className="relative rounded-2xl overflow-hidden flex flex-nowrap gap-1.5 p-2 min-h-[44px] overflow-x-auto md:overflow-x-visible [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
    >
      <img
        src="/backgrounds/background-3.avif"
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />

      {categories.map((cat) => {
        const isActive = active === cat.id;
        return (
          <div
            key={cat.id}
            ref={(el) => setGlassRef(cat.id, el)}
            data-category-id={cat.id}
            role="button"
            tabIndex={0}
            onClick={() => onChange(cat.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(cat.id);
              }
            }}
            className="relative z-[1] shrink-0 flex items-center justify-center cursor-pointer transition-opacity duration-300"
            style={{
              height: 32,
              padding: "0 12px",
              opacity: ready ? 1 : 0,
              ...(fallback
                ? {
                    background: isActive
                      ? "rgba(255,255,255,0.2)"
                      : "rgba(255,255,255,0.08)",
                    backdropFilter: "blur(8px)",
                    WebkitBackdropFilter: "blur(8px)",
                    borderRadius: 20,
                    border: "1px solid rgba(255,255,255,0.15)",
                  }
                : {}),
            }}
          >
            <span
              className="relative z-[2] text-xs font-semibold whitespace-nowrap pointer-events-none"
              style={{
                color: "#fff",
                textShadow: isActive
                  ? "0 1px 6px rgba(0,0,0,0.4)"
                  : "0 1px 4px rgba(0,0,0,0.3)",
              }}
            >
              {cat.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
