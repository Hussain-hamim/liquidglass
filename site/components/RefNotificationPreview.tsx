"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GlassPreset } from "@/lib/presets";
import { useInView } from "@/lib/useInView";
import { acquireGlassSlot, releaseGlassSlot } from "@/lib/glassBudget";
import { isWebGLSupported } from "@/lib/webglSupport";
import { usePrefersReducedTransparency } from "@/lib/usePrefersReducedTransparency";

type ActionBarProps = {
  onPreview: () => void;
  onCopy: () => void;
  mobileOpen: boolean;
};

type NotificationLayout = "stacked" | "single" | "toast";

type NotificationItem = {
  title: string;
  description?: string;
  footer?: string;
  time?: string;
  titleVariant?: "default" | "pixel";
};

function getNotificationLayout(preset: GlassPreset): NotificationLayout {
  if (preset.id === "toast-glass") return "toast";
  if (preset.id === "compact-alert") return "single";
  return "stacked";
}

function getNotificationItems(preset: GlassPreset, layout: NotificationLayout): NotificationItem[] {
  if (layout === "toast") {
    return [{ title: preset.label ?? "Saved" }];
  }

  if (layout === "single") {
    return [
      {
        title: preset.label ?? "Alert",
        description: "New components are available for you",
        time: "12:34",
      },
    ];
  }

  return [
    {
      title: "UI-Layouts",
      description: "New components are available for you",
      footer: "Liquid-Glass",
      time: "12:34",
    },
    {
      title: "tools",
      description: "New components are available for you",
      time: "12:34",
      titleVariant: "pixel",
    },
  ];
}

function LayoutsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <rect x="2" y="4" width="11" height="11" rx="2.5" fill="white" fillOpacity="0.95" />
      <rect x="7" y="2" width="11" height="11" rx="2.5" fill="white" fillOpacity="0.55" />
    </svg>
  );
}

function NotificationIcon() {
  return (
    <div className="shrink-0 w-10 h-10 rounded-[10px] bg-[#0a84ff] flex items-center justify-center shadow-sm">
      <LayoutsIcon />
    </div>
  );
}

function NotificationContent({
  item,
  compact,
}: {
  item: NotificationItem;
  compact?: boolean;
}) {
  return (
    <>
      {!compact && <NotificationIcon />}
      <div className="flex-1 min-w-0">
        <p
          className={`leading-tight text-white ${
            item.titleVariant === "pixel"
              ? "text-[15px] font-bold tracking-tight lowercase font-mono"
              : compact
                ? "text-xs font-semibold"
                : "text-[13px] font-semibold"
          }`}
        >
          {item.title}
        </p>
        {item.description && (
          <p
            className={`text-white/90 leading-snug mt-0.5 ${
              compact ? "text-[10px]" : "text-[11px]"
            }`}
          >
            {item.description}
          </p>
        )}
        {item.footer && (
          <p className="text-[10px] text-white/45 mt-1">{item.footer}</p>
        )}
      </div>
      {item.time && (
        <span className="self-start shrink-0 pt-0.5 text-[10px] text-white/45">
          {item.time}
        </span>
      )}
    </>
  );
}

export function RefNotificationPreview({
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
  paused?: boolean;
}) {
  const { ref: rootRef, inView } = useInView("200px");
  const glassRefs = useRef<(HTMLDivElement | null)[]>([]);
  const instanceRef = useRef<{ destroy: () => void; markChanged?: (element?: HTMLElement) => void } | null>(null);
  const slotAcquiredRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [fallback, setFallback] = useState(false);

  const reducedTransparency = usePrefersReducedTransparency();
  const isModal = previewMode === "modal";

  const layout = getNotificationLayout(preset);
  const items = getNotificationItems(preset, layout);
  const cardWidth = preset.width ?? (layout === "toast" ? 160 : 280);
  const cardHeight = preset.height ?? (layout === "toast" ? 44 : 72);
  const gap = layout === "stacked" ? 12 : 0;
  const bg = preset.background ?? "/backgrounds/background-2.avif";
  const cornerRadius = Number(preset.config.cornerRadius ?? (layout === "toast" ? 50 : 20));

  const configJson = useMemo(
    () => JSON.stringify({ ...preset.config, ...configOverride, floating: false }),
    [preset.id, preset.config, configOverride],
  );

  const configJsonRef = useRef(configJson);
  configJsonRef.current = configJson;

  const cardStyles = useMemo(() => {
    const totalHeight = items.length * cardHeight + Math.max(0, items.length - 1) * gap;

    return items.map((_, index) => {
      const top =
        layout === "stacked"
          ? `calc(50% - ${totalHeight / 2}px + ${index * (cardHeight + gap)}px)`
          : "50%";

      return {
        position: "absolute" as const,
        left: "50%",
        top,
        width: cardWidth,
        height: cardHeight,
        transform: layout === "stacked" ? "translateX(-50%)" : "translate(-50%, -50%)",
      };
    });
  }, [items.length, cardWidth, cardHeight, gap, layout]);

  useEffect(() => {
    const shouldMount = !paused && (isModal || inView);
    if (!shouldMount) {
      setReady(false);
      return;
    }

    const root = rootRef.current;
    const elements = glassRefs.current.filter(Boolean) as HTMLDivElement[];
    if (!root || elements.length !== items.length) return;

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

        elements.forEach((el) => {
          el.dataset.config = configJsonRef.current;
        });

        instance = await LiquidGlass.init({ root, glassElements: elements });
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
  }, [inView, isModal, items.length, reducedTransparency, paused]);

  useEffect(() => {
    if (!ready || fallback || !instanceRef.current) return;
    const elements = glassRefs.current.filter(Boolean) as HTMLDivElement[];
    elements.forEach((el) => {
      el.dataset.config = configJson;
      instanceRef.current?.markChanged?.(el);
    });
  }, [configJson, ready, fallback]);

  const fallbackGlassStyle = reducedTransparency
    ? {
        background: "rgb(28,28,32)",
        border: "1px solid rgba(255,255,255,0.16)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
      }
    : {
        background: "rgba(18,18,22,0.55)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.12)",
      };

  return (
    <div ref={rootRef} className="relative w-full h-full overflow-hidden">
      <img
        src={bg}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />

      {items.map((item, index) => (
        <div
          key={`${preset.id}-${index}`}
          ref={(el) => {
            glassRefs.current[index] = el;
          }}
          className="flex items-center transition-opacity duration-300"
          style={{
            ...cardStyles[index],
            opacity: ready ? 1 : 0,
            borderRadius: cornerRadius,
            padding: layout === "toast" ? "0 16px" : "10px 14px",
            gap: layout === "toast" ? 0 : 12,
            justifyContent: layout === "toast" ? "center" : undefined,
            ...(fallback ? fallbackGlassStyle : {}),
          }}
        >
          {layout === "toast" ? (
            <p className="relative z-[2] text-sm font-semibold text-white pointer-events-none">
              {item.title}
            </p>
          ) : (
            <div className="relative z-[2] flex w-full items-center gap-3 pointer-events-none">
              <NotificationContent item={item} compact={layout === "single" && cardHeight < 64} />
            </div>
          )}
        </div>
      ))}

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
              <p className="text-zinc-100 text-xs font-semibold truncate">{preset.name}</p>
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
