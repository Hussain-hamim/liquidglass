"use client";

import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Glass, type GlassOptics } from "@samasante/liquid-glass";
import {
  MENU_ITEM_ACTIVE_COLOR,
  MENU_ITEM_COLOR,
  MENU_ITEM_HOVER_BG,
} from "@/components/LiquidGlassDropdownMenu";

const sans =
  "-apple-system, 'SF Pro Text', ui-sans-serif, system-ui, sans-serif";

/** Same optics as ref-repo GlassContextMenu (MENU_LENS) */
export const DROPDOWN_LENS: Partial<GlassOptics> = {
  mapSize: 256,
  clipToShape: true,
  softEdge: true,
  depth: 0.65,
  curvature: 0.26,
  dispersion: 0.16,
  strength: 0.22,
  bend: 0.65,
  bendWidth: 0.07,
  frost: 3.5,
  brightness: 0.55,
  specular: 0.8,
  sheenAngle: 45,
  glow: 0.06,
  glowSpread: 1,
  glowFalloff: 0.8,
  sheen: 0.4,
  sheenWidth: 1,
};

export interface GlassDropdownMenuProps {
  items: string[];
  x: number;
  y: number;
  width?: number;
  rowHeight?: number;
  radius?: number;
  fontSize?: number;
  /** CSS background the glass refracts, e.g. url(/backgrounds/foo.jpg) */
  wallpaper: string;
  lens?: Partial<GlassOptics>;
  onSelect?: (label: string) => void;
  onMouseEnter?: () => void;
}

export function GlassDropdownMenu({
  items,
  x,
  y,
  width = 200,
  rowHeight = 36,
  radius = 22,
  fontSize = 15,
  wallpaper,
  lens,
  onSelect,
  onMouseEnter,
}: GlassDropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<number | null>(null);
  const padY = 8;

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const menuW = Math.round(width);
  const menuH = useMemo(
    () => padY * 2 + items.length * rowHeight,
    [items.length, rowHeight],
  );
  const cx = Math.round(x);
  const cy = Math.round(y);
  const ready = size.w > 0 && size.h > 0;

  const refractCopy = (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: -cx,
        top: -cy,
        width: size.w,
        height: size.h,
        background: wallpaper,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    />
  );

  return (
    <div
      ref={containerRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        fontFamily: sans,
        userSelect: "none",
        zIndex: 20,
      }}
    >
      {ready && (
        <>
          <Glass
            optics={{ ...DROPDOWN_LENS, ...lens }}
            brightnessInFilter
            width={menuW}
            height={menuH}
            radius={radius}
            refract={refractCopy}
            behind="#b8569f"
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: menuW,
              height: menuH,
              borderRadius: radius,
            }}
          />
          <div
            role="menu"
            onMouseEnter={onMouseEnter}
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: menuW,
              height: menuH,
              borderRadius: radius,
              padding: `${padY}px 6px`,
              boxSizing: "border-box",
              pointerEvents: "auto",
              zIndex: 21,
              boxShadow:
                "inset 0 0 0 1px rgba(255,255,255,0.5), 0 0 0 0.5px rgba(0,0,0,0.18), 0 16px 40px rgba(0,0,0,0.26), 0 2px 6px rgba(0,0,0,0.18)",
            }}
          >
            {items.map((label, i) => {
              const active = hover === i;
              return (
                <div
                  key={label}
                  role="menuitem"
                  tabIndex={0}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover((cur) => (cur === i ? null : cur))}
                  onClick={() => onSelect?.(label)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: rowHeight,
                    padding: "0 12px",
                    borderRadius: Math.max(6, radius - 10),
                    fontSize,
                    fontWeight: 500,
                    letterSpacing: "-0.01em",
                    cursor: "default",
                    color: active ? MENU_ITEM_ACTIVE_COLOR : MENU_ITEM_COLOR,
                    background: active ? MENU_ITEM_HOVER_BG : "transparent",
                  }}
                >
                  {label}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
