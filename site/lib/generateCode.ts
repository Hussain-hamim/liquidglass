import type { GlassPreset } from "./presets";
import { getLibraryForPreset } from "./presets";
import { GITHUB_REPO_URL } from "./site-url";

function toComponentName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

function samasanteHeader(title: string, extraSteps: string[]): string {
  const steps = [
    "1. Install the library:",
    "   npm install @samasante/liquid-glass",
    "",
    "2. Add to next.config.js (Next.js App Router):",
    "   transpilePackages: [\"@samasante/liquid-glass\"],",
    "",
    "3. Copy the required example component from:",
    "   https://github.com/samasante/liquid-glass/tree/main/examples",
    "",
    ...extraSteps,
    "",
    "Docs: https://github.com/samasante/liquid-glass",
    "This preset uses the React <Glass> component API (not @ybouane/liquidglass).",
  ];
  return `/**
 * ${title}
 *
 * ${steps.join("\n * ")}
 */`;
}

function ybouaneHeader(presetName: string, description: string): string {
  return `/**
 * ${presetName} — Liquid Glass panel
 *
 * ${description}
 *
 * SETUP (for AI agents and developers):
 * 1. Install the library:
 *    npm install @ybouane/liquidglass
 *
 * 2. Add to next.config.js (Next.js App Router):
 *    transpilePackages: ["@ybouane/liquidglass"],
 *
 * 3. Use this component in a client-only React tree ("use client" in Next.js).
 *
 * 4. Structure requirements (LiquidGlass.init):
 *    - \`root\` is the container that holds background + glass elements.
 *    - Each glass element MUST be a direct child of \`root\` (not nested in wrappers).
 *    - Put visible content (image, gradient, video) behind the glass inside \`root\`
 *      so the WebGL shader has pixels to refract/blur.
 *
 * 5. Configure the effect via \`data-config\` JSON on the glass element.
 *    - Set before calling LiquidGlass.init().
 *    - Common keys: cornerRadius, blurAmount, refraction, button, floating, brightness.
 *
 * 6. Call LiquidGlass.init({ root, glassElements }) once on mount.
 *    - Destroy the instance in useEffect cleanup: instance?.destroy()
 *
 * Docs: ${GITHUB_REPO_URL}
 * This preset does NOT use @samasante/liquid-glass.
 */`;
}

function refSwitchCode(name: string): string {
  const componentName = toComponentName(name);
  return `${samasanteHeader(`${name} — Glass Switch`, [
    "4. Copy GlassSwitch.tsx into your project (e.g. ./components/GlassSwitch.tsx).",
    "5. Import GlassSwitch below and render inside a client component.",
  ])}

"use client";
import { useState } from "react";
import { GlassSwitch } from "./GlassSwitch";

export function ${componentName}() {
  const [on, setOn] = useState(false);

  return (
    // GlassSwitch wraps @samasante/liquid-glass <Glass> optics for a macOS-style toggle.
    <GlassSwitch
      checked={on}
      onCheckedChange={setOn}
      width={84}
      height={32}
      tintBlur={5}
      scheme="dark"
      trackColor="#3a3a40"
      activeColor="#0a84ff"
      surface="#0a0a0c"
      ariaLabel="Demo switch"
    />
  );
}`;
}

function refSliderCode(name: string): string {
  const componentName = toComponentName(name);
  return `${samasanteHeader(`${name} — Glass Slider`, [
    "4. Copy GlassSlider.tsx into your project (e.g. ./components/GlassSlider.tsx).",
    "5. Import GlassSlider below and wire value/onValueChange to your state.",
  ])}

"use client";
import { useState } from "react";
import { GlassSlider } from "./GlassSlider";

export function ${componentName}() {
  const [value, setValue] = useState(62);

  return (
    // GlassSlider uses a glass thumb over a track — drag or click to change value.
    <GlassSlider
      value={value}
      onValueChange={setValue}
      min={0}
      max={100}
      width={280}
      thumbHeight={24}
      thumbWidth={38}
      height={6}
      tintBlur={4}
      scheme="dark"
      trackColor="#3a3a40"
      activeColor="#0a84ff"
      surface="#0a0a0c"
      ariaLabel="Demo slider"
    />
  );
}`;
}

function refVideoCode(name: string): string {
  const componentName = toComponentName(name);
  return `${samasanteHeader(`${name} — Glass Video Controls`, [
    "4. Copy GlassVideoControls.tsx into your project.",
    "5. Provide a video file at src (or replace with your CDN URL).",
    "6. Wrap in a positioned container with aspect-ratio for layout.",
  ])}

"use client";
import { GlassVideoControls } from "./GlassVideoControls";

export function ${componentName}() {
  return (
    // Full-bleed video with glass transport controls (play, scrub, volume).
    <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9" }}>
      <GlassVideoControls src="/your-video.mp4" />
    </div>
  );
}`;
}

function refMenuCode(name: string, bg: string): string {
  const componentName = toComponentName(name);
  return `${samasanteHeader(`${name} — Glass Dropdown Menu`, [
    "4. Copy GlassDropdownMenu.tsx into your project.",
    "   (Uses @samasante/liquid-glass <Glass> with backdrop-filter lens.)",
    "5. Place a wallpaper/background image behind the menu root for refraction.",
    "6. Position the menu with x/y relative to the root container.",
  ])}

"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { GlassDropdownMenu } from "./GlassDropdownMenu";

const ITEMS = ["Overview", "Features", "Integrations", "Changelog", "Pricing"];

export function ${componentName}() {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  // Recompute menu position when opened or on resize.
  useLayoutEffect(() => {
    if (!open || !rootRef.current || !triggerRef.current) return;
    const cr = rootRef.current.getBoundingClientRect();
    const tr = triggerRef.current.getBoundingClientRect();
    setPos({ x: tr.left - cr.left, y: tr.bottom - cr.top + 12 });
  }, [open]);

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%", height: 320 }}>
      {/* Background wallpaper — required for glass refraction */}
      <img
        src="${bg}"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          position: "relative",
          zIndex: 2,
          margin: 20,
          color: "#fff",
          background: "none",
          border: "none",
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Product ▾
      </button>
      {open && (
        <GlassDropdownMenu
          items={ITEMS}
          x={pos.x}
          y={pos.y}
          wallpaper="url(${bg})"
        />
      )}
    </div>
  );
}`;
}

function ybouaneGlassCode(preset: GlassPreset): string {
  const componentName = toComponentName(preset.name) + "Glass";
  const label = preset.label ?? preset.name;
  const width = preset.width ?? 180;
  const height = preset.height ?? 100;
  const bg = preset.background ?? "/backgrounds/background-1.avif";
  const configStr = JSON.stringify(preset.config, null, 4)
    .split("\n")
    .map((line, i) => (i === 0 ? line : "    " + line))
    .join("\n");

  const floatingNote = preset.config.floating
    ? "\n * - floating: true enables drag — glass element must stay a direct child of root."
    : "";
  const buttonNote = preset.config.button
    ? "\n * - button: true enables hover/press glass button styling."
    : "";

  return `${ybouaneHeader(
    preset.name,
    `WebGL liquid glass effect using @ybouane/liquidglass.${floatingNote}${buttonNote}`
  )}

"use client";
import { useEffect, useRef } from "react";
import { LiquidGlass } from "@ybouane/liquidglass";

export function ${componentName}() {
  const rootRef = useRef<HTMLDivElement>(null);
  const glassRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const glass = glassRef.current;
    if (!root || !glass) return;

    let instance: Awaited<ReturnType<typeof LiquidGlass.init>> | undefined;
    let cancelled = false;

    (async () => {
      // Glass config — applied via data-config before init.
      glass.dataset.config = JSON.stringify(${configStr});

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
  }, []);

  return (
    // Root container — background + glass must both be direct children here.
    <div ref={rootRef} style={{ position: "relative", width: "100%", height: 300, overflow: "hidden" }}>
      {/* Background content the glass refracts — replace with your image or UI */}
      <img
        src="${bg}"
        alt=""
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />

      {/* Glass element — MUST be a direct child of rootRef */}
      <div
        ref={glassRef}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: ${width},
          height: ${height},
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            position: "relative",
            zIndex: 2,
            color: "#fff",
            fontWeight: 600,
            textShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        >
          ${label}
        </span>
      </div>
    </div>
  );
}`;
}

export function generateComponentCode(preset: GlassPreset): string {
  if (preset.interactive === "switch" || preset.interactive === "toggle") {
    return refSwitchCode(preset.name);
  }
  if (preset.interactive === "slider") {
    return refSliderCode(preset.name);
  }
  if (preset.interactive === "play" || preset.interactive === "media-bar") {
    return refVideoCode(preset.name);
  }
  if (preset.interactive === "menu") {
    return refMenuCode(preset.name, preset.background ?? "/backgrounds/background-1.avif");
  }

  return ybouaneGlassCode(preset);
}

export function getInstallCommand(preset: GlassPreset): string {
  return `npm i ${getLibraryForPreset(preset).pkg}`;
}
