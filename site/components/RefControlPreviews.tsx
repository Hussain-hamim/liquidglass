"use client";

import { useState } from "react";
import type { GlassPreset } from "@/lib/presets";
import { GlassSwitch } from "@/components/ref/GlassSwitch";
import { GlassSlider } from "@/components/ref/GlassSlider";
import { GlassVideoControls } from "@/components/ref/GlassVideoControls";
import { useInView } from "@/lib/useInView";

const SURFACE = "#0a0a0c";
const TRACK = "#3a3a40";
const ACTIVE = "#0a84ff";

function RefControlFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ background: "rgba(0,0,0,0.25)" }}
      >
        {children}
      </div>
    </div>
  );
}

export function RefSwitchPreview({ preset: _preset, bg: _bg }: { preset: GlassPreset; bg: string }) {
  const [on, setOn] = useState(true);

  return (
    <RefControlFrame>
      <GlassSwitch
        checked={on}
        onCheckedChange={setOn}
        width={84}
        height={32}
        tintBlur={5}
        scheme="dark"
        trackColor={TRACK}
        activeColor={ACTIVE}
        surface={SURFACE}
        ariaLabel="Demo switch"
      />
    </RefControlFrame>
  );
}

export function RefSliderPreview({ preset: _preset, bg: _bg }: { preset: GlassPreset; bg: string }) {
  const [v, setV] = useState(62);

  return (
    <RefControlFrame>
      <GlassSlider
        value={v}
        onValueChange={setV}
        min={0}
        max={100}
        width={280}
        thumbHeight={24}
        thumbWidth={38}
        height={6}
        tintBlur={4}
        scheme="dark"
        trackColor={TRACK}
        activeColor={ACTIVE}
        surface={SURFACE}
        ariaLabel="Demo slider"
      />
    </RefControlFrame>
  );
}

export function RefTogglePreview(props: { preset: GlassPreset; bg: string }) {
  return <RefSwitchPreview {...props} />;
}

function LazyVideoPreview() {
  const { ref, inView } = useInView("150px");

  return (
    <div ref={ref} className="relative w-full h-full overflow-hidden bg-black">
      {inView ? (
        <GlassVideoControls src="/media/clip.mp4" />
      ) : (
        <div className="absolute inset-0 bg-zinc-900 animate-pulse" />
      )}
    </div>
  );
}

export function RefVideoPreview({ preset: _preset, bg: _bg }: { preset?: GlassPreset; bg: string }) {
  return <LazyVideoPreview />;
}

export function RefPlayPreview(props: { preset: GlassPreset; bg: string }) {
  return <RefVideoPreview {...props} />;
}

export function RefMediaBarPreview(props: { preset: GlassPreset; bg: string }) {
  return <RefVideoPreview {...props} />;
}
