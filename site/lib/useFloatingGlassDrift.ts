"use client";

import { useEffect, useRef, type RefObject } from "react";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

type LiquidGlassInstance = {
  destroy: () => void;
  markChanged?: (element?: HTMLElement) => void;
};

function getTranslateXY(el: HTMLElement): [number, number] {
  const style = getComputedStyle(el);
  const matrix = style.transform;
  if (!matrix || matrix === "none") return [0, 0];
  const m = matrix.match(/matrix\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(",").map(Number);
    return [parts[4] || 0, parts[5] || 0];
  }
  return [0, 0];
}

const USER_IDLE_MS = 2000;
/** Radians per second — lower = slower drift. */
const DRIFT_SPEED_X = 0.22;
const DRIFT_SPEED_Y = 0.17;

export function useFloatingGlassDrift({
  enabled,
  rootRef,
  glassRef,
  instanceRef,
  width,
  height,
}: {
  enabled: boolean;
  rootRef: RefObject<HTMLElement | null>;
  glassRef: RefObject<HTMLElement | null>;
  instanceRef: RefObject<LiquidGlassInstance | null>;
  width: number;
  height: number;
}) {
  const centerRef = useRef({ tx: 0, ty: 0 });
  const userActiveRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const phaseRef = useRef(Math.random() * Math.PI * 2);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!enabled || reducedMotion) return;

    const root = rootRef.current;
    const glass = glassRef.current;
    if (!root || !glass) return;

    const [tx, ty] = getTranslateXY(glass);
    centerRef.current = { tx, ty };
    startTimeRef.current = performance.now();

    const pauseForUser = () => {
      userActiveRef.current = true;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };

    const scheduleResume = () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        const g = glassRef.current;
        if (!g) return;
        const [cx, cy] = getTranslateXY(g);
        centerRef.current = { tx: cx, ty: cy };
        startTimeRef.current = performance.now();
        userActiveRef.current = false;
      }, USER_IDLE_MS);
    };

    const onPointerDown = (e: PointerEvent) => {
      const g = glassRef.current;
      if (!g) return;
      if (e.target === g || g.contains(e.target as Node)) {
        pauseForUser();
      }
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("pointerup", scheduleResume);
    root.addEventListener("pointercancel", scheduleResume);
    root.addEventListener("pointerleave", scheduleResume);

    const tick = (now: number) => {
      const r = rootRef.current;
      const g = glassRef.current;
      const instance = instanceRef.current;

      if (r && g && !userActiveRef.current) {
        const rootRect = r.getBoundingClientRect();
        const margin = 10;
        const rangeX = Math.max(0, rootRect.width / 2 - width / 2 - margin);
        const rangeY = Math.max(0, rootRect.height / 2 - height / 2 - margin);

        const t = (now - startTimeRef.current) / 1000;
        const phase = phaseRef.current;
        const driftX = Math.sin(t * DRIFT_SPEED_X + phase) * rangeX * 0.9;
        const driftY = Math.cos(t * DRIFT_SPEED_Y + phase * 1.2) * rangeY * 0.9;

        const { tx: centerTx, ty: centerTy } = centerRef.current;
        g.style.transform = `translate(${centerTx + driftX}px, ${centerTy + driftY}px)`;
        instance?.markChanged?.(g);
      }

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("pointerup", scheduleResume);
      root.removeEventListener("pointercancel", scheduleResume);
      root.removeEventListener("pointerleave", scheduleResume);
      const g = glassRef.current;
      if (g) {
        g.style.transform = "";
      }
    };
  }, [enabled, reducedMotion, rootRef, glassRef, instanceRef, width, height]);
}
