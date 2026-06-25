"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the OS-level "Reduce transparency" accessibility setting.
 * When enabled, glass effects should render as an opaque panel so text
 * sits on a solid, high-contrast surface (per WCAG / the liquid-glass
 * accessibility guidance at https://glass.outpacestudios.com/).
 */
export function usePrefersReducedTransparency(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-transparency: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}
