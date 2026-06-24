"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const sans =
  "-apple-system, 'SF Pro Text', ui-sans-serif, system-ui, sans-serif";

const PANEL_EDGE =
  "inset 0 0 0 1px rgba(255,255,255,0.5), 0 0 0 0.5px rgba(0,0,0,0.18), 0 16px 40px rgba(0,0,0,0.26), 0 2px 6px rgba(0,0,0,0.18)";

/** Frosted glass row highlight — reads naturally over refracted glass */
export const MENU_ITEM_HOVER_BG = "rgba(255, 255, 255, 0.32)";
export const MENU_ITEM_COLOR = "rgba(255, 255, 255, 0.9)";
export const MENU_ITEM_ACTIVE_COLOR = "rgba(255, 255, 255, 1)";

export const MENU_GLASS_PRESETS: Record<string, Record<string, unknown>> = {
  Product: {
    chromAberration: 0.15,
    refraction: 1.1,
    blurAmount: 0.2,
    edgeHighlight: 0.2,
    cornerRadius: 40,
    saturation: 0.3,
  },
  Resources: { chromAberration: 0.25, refraction: 1, cornerRadius: 36 },
  Company: { floating: true, cornerRadius: 40, blurAmount: 0 },
};

export interface LiquidGlassDropdownMenuProps {
  rootRef: RefObject<HTMLDivElement | null>;
  items: string[];
  x: number;
  y: number;
  glassConfig: Record<string, unknown>;
  width?: number;
  rowHeight?: number;
  fontSize?: number;
  onSelect?: (label: string) => void;
  onMouseEnter?: () => void;
}

export function LiquidGlassDropdownMenu({
  rootRef,
  items,
  x,
  y,
  glassConfig,
  width = 200,
  rowHeight = 36,
  fontSize = 15,
  onSelect,
  onMouseEnter,
}: LiquidGlassDropdownMenuProps) {
  const glassRef = useRef<HTMLDivElement | null>(null);
  const [glassReady, setGlassReady] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const padY = 8;
  const cornerRadius = Number(glassConfig.cornerRadius ?? 36);

  const menuW = Math.round(width);
  const menuH = useMemo(
    () => padY * 2 + items.length * rowHeight,
    [items.length, rowHeight],
  );

  const glassStyle = useMemo(
    () => ({
      position: "absolute" as const,
      left: x,
      top: y,
      width: menuW,
      height: menuH,
      zIndex: 20,
      pointerEvents: "none" as const,
    }),
    [x, y, menuW, menuH],
  );

  useLayoutEffect(() => {
    setGlassReady(!!glassRef.current);
  }, [x, y, menuW, menuH]);

  useLayoutEffect(() => {
    const glass = glassRef.current;
    if (!glass) return;
    Object.assign(glass.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${menuW}px`,
      height: `${menuH}px`,
    });
  }, [x, y, menuW, menuH]);

  useEffect(() => {
    const root = rootRef.current;
    const glass = glassRef.current;
    if (!root || !glass || !glassReady) return;

    let instance: { destroy: () => void } | undefined;
    let cancelled = false;

    (async () => {
      const { LiquidGlass } = await import("@ybouane/liquidglass");
      if (cancelled) return;

      glass.dataset.config = JSON.stringify(glassConfig);
      instance = await LiquidGlass.init({
        root,
        glassElements: [glass],
      });
      if (cancelled) instance?.destroy();
    })();

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [rootRef, glassReady, items, menuW, menuH, glassConfig]);

  const root = rootRef.current;

  return (
    <>
      {root &&
        createPortal(
          <div
            ref={glassRef}
            aria-hidden
            style={glassStyle}
          />,
          root,
        )}
      <div
        role="menu"
        onMouseEnter={onMouseEnter}
        style={{
          position: "absolute",
          left: x,
          top: y,
          width: menuW,
          height: menuH,
          borderRadius: cornerRadius,
          padding: `${padY}px 6px`,
          boxSizing: "border-box",
          pointerEvents: "auto",
          zIndex: 21,
          fontFamily: sans,
          userSelect: "none",
          boxShadow: PANEL_EDGE,
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
                padding: "0 14px",
                borderRadius: Math.max(6, cornerRadius - 10),
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
  );
}
