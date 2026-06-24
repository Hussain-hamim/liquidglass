"use client";

import type { GlassPreset } from "@/lib/presets";
import { GlassNavDemo } from "@/components/GlassNavDemo";
import { MENU_GLASS_PRESETS } from "@/components/LiquidGlassDropdownMenu";

export function RefMenuDropdownPreview({
  preset,
  bg,
}: {
  preset: GlassPreset;
  bg: string;
}) {
  return (
    <GlassNavDemo
      background={bg}
      compact
      glassEngine="ybouane"
      glassConfig={{ ...MENU_GLASS_PRESETS.Product, ...(preset.config ?? {}) }}
      menuAlwaysOpen
      className="rounded-none border-0 shadow-none"
    />
  );
}
