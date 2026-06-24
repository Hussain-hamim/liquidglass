"use client";

import type { GlassPreset } from "@/lib/presets";
import { GlassNavDemo } from "@/components/GlassNavDemo";
import { MENU_GLASS_PRESETS } from "@/components/LiquidGlassDropdownMenu";
import { useInView } from "@/lib/useInView";

export function RefMenuDropdownPreview({
  preset,
  bg,
}: {
  preset: GlassPreset;
  bg: string;
}) {
  const { ref, inView } = useInView("200px");

  return (
    <div ref={ref} className="relative w-full h-full">
      <GlassNavDemo
        background={bg}
        compact
        glassEngine="ybouane"
        glassConfig={{ ...MENU_GLASS_PRESETS.Product, ...(preset.config ?? {}) }}
        autoCycle={inView}
        autoCloseBetweenCycles
        className="rounded-none border-0 shadow-none"
      />
    </div>
  );
}
