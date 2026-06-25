"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GlassPreset } from "@/lib/presets";
import { getLibraryForPreset } from "@/lib/presets";
import { generateComponentCode, getInstallCommand } from "@/lib/generateCode";
import { mergeGlassConfig } from "@/lib/glassConfigControls";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { CodeBlock } from "@/components/CodeBlock";
import { GlassCustomizer } from "@/components/GlassCustomizer";
import { GlassPreview } from "@/components/GlassPreview";
import { Button } from "@/components/ui/button";

type Tab = "studio" | "code" | "preview";

function ModalPreview({
  preset,
  configOverride,
  isWide,
  className = "",
}: {
  preset: GlassPreset;
  configOverride: Record<string, unknown>;
  isWide: boolean;
  className?: string;
}) {
  return (
    <div
      className={`relative w-full mx-auto overflow-hidden rounded-xl border border-white/[0.06] bg-black ${
        isWide ? "aspect-video max-w-3xl" : "aspect-square max-w-xl max-h-full"
      } ${className}`}
    >
      <GlassPreview
        preset={preset}
        configOverride={configOverride}
        previewMode="modal"
      />
    </div>
  );
}

export function PresetModal({
  preset,
  open,
  onClose,
  onCopy,
}: {
  preset: GlassPreset;
  open: boolean;
  onClose: () => void;
  onCopy: (message: string) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<Tab>("studio");
  const [configOverride, setConfigOverride] = useState<Record<string, unknown>>({});

  const canCustomize = !preset.interactive;
  const installCmd = getInstallCommand(preset);
  const lib = getLibraryForPreset(preset);

  const mergedConfig = useMemo(
    () => mergeGlassConfig(preset.config, configOverride),
    [preset.config, configOverride],
  );

  const code = useMemo(
    () => generateComponentCode(preset, mergedConfig),
    [preset, mergedConfig],
  );

  useFocusTrap(dialogRef, open, onClose);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTab(canCustomize ? "studio" : "preview");
    setConfigOverride({});
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
    };
  }, [open, preset.id, canCustomize]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const isWide =
    preset.interactive === "play" || preset.interactive === "media-bar";

  const handleConfigChange = (key: string, value: number | boolean) => {
    setConfigOverride((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetConfig = () => setConfigOverride({});

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code);
    onCopy("Copied to clipboard!");
  };

  const tabs: { id: Tab; label: string }[] = [
    ...(canCustomize ? [{ id: "studio" as Tab, label: "Studio" }] : [{ id: "preview" as Tab, label: "Preview" }]),
    { id: "code", label: "Code" },
  ];

  const dialogMaxWidth =
    tab === "studio"
      ? "max-w-6xl"
      : tab === "code"
        ? "max-w-3xl"
        : isWide
          ? "max-w-4xl"
          : "max-w-2xl";

  const modal = (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 glass-modal-overlay-enter"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`preset-modal-title-${preset.id}`}
        className={`relative w-full flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-border bg-card/95 backdrop-blur-md max-h-[92vh] glass-modal-dialog-enter ${dialogMaxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h2
              id={`preset-modal-title-${preset.id}`}
              className="text-sm font-semibold text-foreground truncate"
            >
              {preset.name}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{lib.pkg}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
              aria-selected={tab === t.id}
              role="tab"
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div
          className={`flex-1 p-5 min-h-0 ${
            tab === "studio" ? "overflow-y-auto lg:overflow-hidden" : "overflow-hidden"
          }`}
        >
          {tab === "preview" && !canCustomize && (
            <div className="h-full flex items-center justify-center">
              <ModalPreview
                preset={preset}
                configOverride={configOverride}
                isWide={isWide}
                className={isWide ? "w-full max-w-3xl" : "w-full max-w-lg"}
              />
            </div>
          )}

          {tab === "code" && (
            <div className="space-y-3 overflow-y-auto max-h-[min(65vh,520px)]">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-900/80 border border-white/[0.06]">
                <code className="text-[11px] text-zinc-300 font-mono flex-1">{installCmd}</code>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(installCmd);
                    onCopy("Copied install command!");
                  }}
                  className="text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  Copy
                </button>
              </div>
              {!preset.interactive && (
                <p className="text-[11px] text-zinc-500 px-1">
                  Add{" "}
                  <code className="text-zinc-400">transpilePackages: [&quot;@ybouane/liquidglass&quot;]</code>{" "}
                  to your Next.js config.
                </p>
              )}
              <CodeBlock
                code={code}
                language="tsx"
                filename={`${preset.name.replace(/\s+/g, "")}.tsx`}
                onCopy={() => onCopy("Copied to clipboard!")}
              />
            </div>
          )}

          {tab === "studio" && canCustomize && (
            <div className="flex flex-col-reverse lg:flex-row gap-5 lg:h-[min(68vh,620px)] lg:min-h-[360px]">
              {/* Controls — below preview on mobile, left on desktop */}
              <div className="lg:w-[340px] xl:w-[380px] shrink-0 flex flex-col lg:min-h-0 border-t lg:border-t-0 lg:border-r border-border pt-5 lg:pt-0 lg:pr-5">
                <GlassCustomizer
                  config={mergedConfig}
                  onChange={handleConfigChange}
                  onReset={handleResetConfig}
                  compact
                />
              </div>

              {/* Live preview — top on mobile, right on desktop */}
              <div className="shrink-0 lg:flex-1 lg:min-w-0 lg:min-h-0 flex flex-col">
                <p className="text-[11px] font-medium text-muted-foreground mb-3 shrink-0">
                  Live preview — drag the glass to move it
                </p>
                <div className="w-full max-w-sm mx-auto lg:max-w-none lg:flex-1 lg:min-h-0 lg:flex lg:items-center lg:justify-center">
                  <ModalPreview
                    preset={preset}
                    configOverride={configOverride}
                    isWide={isWide}
                    className="w-full max-h-full lg:max-w-xl lg:mx-auto"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <Button
            type="button"
            size="sm"
            className="rounded-full normal-case tracking-normal font-medium"
            onClick={handleCopyCode}
          >
            Copy Code
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="rounded-full normal-case tracking-normal font-medium"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
