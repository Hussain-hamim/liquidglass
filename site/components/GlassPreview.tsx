"use client";

import type { GlassPreset } from "@/lib/presets";
import {
  RefSwitchPreview,
  RefSliderPreview,
  RefTogglePreview,
  RefPlayPreview,
  RefMediaBarPreview,
} from "./RefControlPreviews";
import { RefMenuDropdownPreview } from "./RefMenuDropdownPreview";
import { StaticGlassPreview } from "./StaticGlassPreview";

export function GlassPreview({ preset }: { preset: GlassPreset }) {
  const bg = preset.background ?? "/backgrounds/background-1.avif";

  switch (preset.interactive) {
    case "switch":
      return <RefSwitchPreview preset={preset} bg={bg} />;
    case "slider":
      return <RefSliderPreview preset={preset} bg={bg} />;
    case "toggle":
      return <RefTogglePreview preset={preset} bg={bg} />;
    case "play":
      return <RefPlayPreview preset={preset} bg={bg} />;
    case "media-bar":
      return <RefMediaBarPreview preset={preset} bg={bg} />;
    case "menu":
      return <RefMenuDropdownPreview preset={preset} bg={bg} />;
    default:
      return <StaticGlassPreview preset={preset} />;
  }
}
