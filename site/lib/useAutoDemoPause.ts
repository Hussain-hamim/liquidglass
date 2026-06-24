"use client";

import { useEffect, useRef, type RefObject } from "react";

export const AUTO_DEMO_USER_IDLE_MS = 2000;

export function useAutoDemoPause(
  containerRef: RefObject<HTMLElement | null>,
  enabled = true,
) {
  const userActiveRef = useRef(false);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = containerRef.current;
    if (!el) return;

    const pause = () => {
      userActiveRef.current = true;
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };

    const scheduleResume = () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        userActiveRef.current = false;
      }, AUTO_DEMO_USER_IDLE_MS);
    };

    el.addEventListener("pointerdown", pause);
    el.addEventListener("pointerup", scheduleResume);
    el.addEventListener("pointercancel", scheduleResume);
    el.addEventListener("pointerleave", scheduleResume);

    return () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("pointerup", scheduleResume);
      el.removeEventListener("pointercancel", scheduleResume);
      el.removeEventListener("pointerleave", scheduleResume);
    };
  }, [containerRef, enabled]);

  return userActiveRef;
}
