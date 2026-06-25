"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";
import { GlassDropdownMenu } from "@/components/ref/GlassDropdownMenu";
import {
  LiquidGlassDropdownMenu,
  MENU_GLASS_PRESETS,
} from "@/components/LiquidGlassDropdownMenu";

const NAV_BTN_GLASS = {
  button: true,
  cornerRadius: 20,
  blurAmount: 0.25,
  brightness: -0.05,
};

const NAV = [
  {
    label: "Product",
    items: ["Overview", "Features", "Integrations", "Changelog", "Pricing"],
  },
  {
    label: "Resources",
    items: ["Documentation", "Examples", "Blog", "Community"],
  },
  {
    label: "Company",
    items: ["About", "Careers", "Press", "Contact"],
  },
] as const;

const NAV_LABELS = NAV.map((n) => n.label);
/** Stable reference — avoid NAV.slice() in render (causes infinite setState loops). */
const NAV_COMPACT = [NAV[0]];
const CYCLE_MS = 2000;
const USER_IDLE_MS = 2000;

function toWallpaper(src: string) {
  return src.startsWith("url(") ? src : `url(${src})`;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      className={`opacity-80 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M2 3.5L5 6.5L8 3.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GlassNavDemo({
  background = "/backgrounds/background-3.avif",
  compact = false,
  className = "",
  glassEngine = "ybouane",
  glassConfig: glassConfigProp,
  autoCycle = !compact,
  autoCloseBetweenCycles = false,
  menuAlwaysOpen = false,
}: {
  background?: string;
  compact?: boolean;
  className?: string;
  glassEngine?: "samasante" | "ybouane";
  glassConfig?: Record<string, unknown>;
  autoCycle?: boolean;
  autoCloseBetweenCycles?: boolean;
  menuAlwaysOpen?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userActive = useRef(false);
  const reducedMotion = usePrefersReducedMotion();
  const effectiveAutoCycle = autoCycle && !reducedMotion;

  const [openLabel, setOpenLabel] = useState<string | null>(
    autoCloseBetweenCycles ? null : "Product",
  );
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const navGlassRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const navGlassInstance = useRef<{ destroy: () => void } | null>(null);
  const [btnPositions, setBtnPositions] = useState<Record<string, { x: number; y: number; w: number; h: number }>>({});

  const wallpaper = toWallpaper(background);
  const navItems = compact && !autoCycle ? NAV_COMPACT : NAV;
  const openItems = NAV.find((n) => n.label === openLabel)?.items ?? [];
  const openGlassConfig =
    glassConfigProp ??
    (openLabel ? MENU_GLASS_PRESETS[openLabel] : undefined) ??
    MENU_GLASS_PRESETS.Product;

  const updateMenuPos = useCallback((label: string) => {
    const root = rootRef.current;
    const trigger = triggerRefs.current[label];
    if (!root || !trigger) return;
    const cr = root.getBoundingClientRect();
    const tr = trigger.getBoundingClientRect();
    setMenuPos((prev) => {
      const next = {
        x: tr.left - cr.left,
        y: tr.bottom - cr.top + (compact ? 8 : 12),
      };
      if (prev.x === next.x && prev.y === next.y) return prev;
      return next;
    });
  }, [compact]);

  const updateBtnPositions = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const cr = root.getBoundingClientRect();
    const pad = 6;
    const positions: typeof btnPositions = {};
    for (const { label } of navItems) {
      const btn = triggerRefs.current[label];
      if (!btn) continue;
      const br = btn.getBoundingClientRect();
      positions[label] = {
        x: br.left - cr.left - pad,
        y: br.top - cr.top - pad / 2,
        w: br.width + pad * 2,
        h: br.height + pad,
      };
    }
    setBtnPositions((prev) => {
      const prevKeys = Object.keys(prev);
      const nextKeys = Object.keys(positions);
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => {
          const p = prev[key];
          const n = positions[key];
          return (
            p &&
            n &&
            p.x === n.x &&
            p.y === n.y &&
            p.w === n.w &&
            p.h === n.h
          );
        })
      ) {
        return prev;
      }
      return positions;
    });
  }, [compact, autoCycle]);

  useLayoutEffect(() => {
    updateBtnPositions();
    if (!openLabel) return;
    updateMenuPos(openLabel);
    const onResize = () => {
      updateBtnPositions();
      if (openLabel) updateMenuPos(openLabel);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [openLabel, updateBtnPositions, updateMenuPos]);

  // Init glass on nav buttons once portal refs are in the DOM
  const btnPosKeys = Object.keys(btnPositions).sort().join(",");
  useEffect(() => {
    if (glassEngine !== "ybouane" || !btnPosKeys) return;
    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;

    const raf = requestAnimationFrame(() => {
      const elements = Object.values(navGlassRefs.current).filter(Boolean) as HTMLDivElement[];
      if (elements.length === 0 || cancelled) return;

      elements.forEach((el) => {
        el.dataset.config = JSON.stringify(NAV_BTN_GLASS);
      });

      (async () => {
        const { LiquidGlass } = await import("@ybouane/liquidglass");
        if (cancelled) return;

        navGlassInstance.current?.destroy();
        navGlassInstance.current = await LiquidGlass.init({
          root,
          glassElements: elements,
        });
      })();
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      navGlassInstance.current?.destroy();
      navGlassInstance.current = null;
    };
  }, [glassEngine, btnPosKeys]);

  const clearCloseTimer = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const stopAutoCycle = () => {
    if (cycleTimer.current) clearInterval(cycleTimer.current);
    cycleTimer.current = null;
  };

  const clearResumeTimer = () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  };

  const pauseForUser = () => {
    userActive.current = true;
    clearCloseTimer();
    clearResumeTimer();
  };

  const scheduleResumeAuto = () => {
    if (!effectiveAutoCycle) return;
    clearResumeTimer();
    resumeTimer.current = setTimeout(() => {
      userActive.current = false;
    }, USER_IDLE_MS);
  };

  const advanceMenu = () => {
    setOpenLabel((prev) => {
      if (autoCloseBetweenCycles) {
        if (prev === null) return NAV_LABELS[0];
        const idx = NAV_LABELS.indexOf(prev as (typeof NAV_LABELS)[number]);
        if (idx === NAV_LABELS.length - 1) return null;
        return NAV_LABELS[idx + 1];
      }

      const idx = prev ? NAV_LABELS.indexOf(prev as (typeof NAV_LABELS)[number]) : -1;
      return NAV_LABELS[(idx + 1) % NAV_LABELS.length];
    });
  };

  useEffect(() => {
    if (!effectiveAutoCycle) return;

    cycleTimer.current = setInterval(() => {
      if (userActive.current) return;
      advanceMenu();
    }, CYCLE_MS);

    return () => {
      stopAutoCycle();
      clearResumeTimer();
      clearCloseTimer();
    };
  }, [effectiveAutoCycle]);

  const openMenu = (label: string) => {
    clearCloseTimer();
    setOpenLabel(label);
    requestAnimationFrame(() => updateMenuPos(label));
  };

  const handleUserOpen = (label: string) => {
    pauseForUser();
    openMenu(label);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpenLabel(null), 150);
  };

  const handleRootLeave = () => {
    if (menuAlwaysOpen) return;
    if (autoCycle) {
      scheduleResumeAuto();
      return;
    }
    scheduleClose();
  };

  const handleUserSelect = () => {
    pauseForUser();
    if (!autoCycle && !menuAlwaysOpen) scheduleClose();
  };

  return (
    <div
      ref={rootRef}
      className={`relative w-full h-full overflow-hidden ${className}`}
      onMouseLeave={handleRootLeave}
    >
      <img
        src={background}
        alt=""
        loading="lazy"
        decoding="async"
        className="absolute inset-0 w-full h-full object-cover"
      />

      <div
        className={`absolute inset-x-0 top-0 z-10 ${compact ? "px-3 pt-3" : "px-6 pt-5"}`}
      >
        <nav className={`flex items-center ${compact ? "gap-3" : "gap-8"}`}>
          {navItems.map(({ label }) => {
            const open = openLabel === label;
            return (
              <button
                key={label}
                ref={(el) => {
                  triggerRefs.current[label] = el;
                }}
                type="button"
                className={`flex items-center gap-1.5 font-medium text-white/95 hover:text-white transition-colors ${
                  compact ? "text-[13px]" : "text-[15px]"
                }`}
                aria-expanded={open}
                aria-haspopup="menu"
                onMouseEnter={() => handleUserOpen(label)}
                onFocus={() => handleUserOpen(label)}
                onClick={() => {
                  pauseForUser();
                  if (menuAlwaysOpen) {
                    openMenu(label);
                    return;
                  }
                  if (open) {
                    setOpenLabel(null);
                  } else {
                    openMenu(label);
                  }
                }}
              >
                {label}
                <Chevron open={open} />
              </button>
            );
          })}
        </nav>
      </div>

      {/* Glass pill overlays for nav buttons — portaled as direct children of root */}
      {(() => {
        const root = rootRef.current;
        if (glassEngine !== "ybouane" || !root) return null;
        return navItems.map(({ label }) => {
          const pos = btnPositions[label];
          if (!pos) return null;
          return createPortal(
            <div
              key={`nav-glass-${label}`}
              ref={(el) => { navGlassRefs.current[label] = el; }}
              aria-hidden
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                width: pos.w,
                height: pos.h,
                zIndex: 9,
                pointerEvents: "none",
              }}
            />,
            root,
          );
        });
      })()}

      {openLabel && openItems.length > 0 &&
        (glassEngine === "ybouane" ? (
          <LiquidGlassDropdownMenu
            rootRef={rootRef}
            items={[...openItems]}
            x={menuPos.x}
            y={menuPos.y}
            glassConfig={openGlassConfig}
            width={compact ? 168 : 200}
            rowHeight={compact ? 28 : 36}
            fontSize={compact ? 13 : 15}
            onMouseEnter={pauseForUser}
            onSelect={handleUserSelect}
          />
        ) : (
          <GlassDropdownMenu
            items={[...openItems]}
            x={menuPos.x}
            y={menuPos.y}
            wallpaper={wallpaper}
            width={compact ? 168 : 200}
            rowHeight={compact ? 28 : 36}
            radius={compact ? 16 : 22}
            fontSize={compact ? 13 : 15}
            onMouseEnter={pauseForUser}
            onSelect={handleUserSelect}
          />
        ))}
    </div>
  );
}
