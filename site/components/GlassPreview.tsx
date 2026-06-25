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
import { RefNotificationPreview } from "./RefNotificationPreview";
import { StaticGlassPreview } from "./StaticGlassPreview";

type ActionBarProps = {
  onPreview: () => void;
  onCopy: () => void;
  mobileOpen: boolean;
};

export function GlassPreview({
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
      if (preset.category === "notifications") {
        return (
          <RefNotificationPreview
            preset={preset}
            actionBar={actionBar}
            configOverride={configOverride}
            previewMode={previewMode}
            paused={paused}
          />
        );
      }
      return (
        <StaticGlassPreview
          preset={preset}
          actionBar={actionBar}
          configOverride={configOverride}
          previewMode={previewMode}
          paused={paused}
        />
      );
  }
}
