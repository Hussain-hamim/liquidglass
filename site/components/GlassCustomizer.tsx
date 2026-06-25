"use client";

import { GLASS_CUSTOMIZER_CONTROLS } from "@/lib/glassConfigControls";

export function GlassCustomizer({
  config,
  onChange,
  onReset,
  compact = false,
}: {
  config: Record<string, unknown>;
  onChange: (key: string, value: number | boolean) => void;
  onReset: () => void;
  /** When true, fills parent height (split-panel layout). */
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-4 ${compact ? "lg:h-full lg:min-h-0" : ""}`}>
      <div className="flex items-center justify-between gap-2 shrink-0">
        <p className="text-xs font-medium text-zinc-400">Tweak glass parameters live</p>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Reset
        </button>
      </div>

      <div
        className={`pr-1 space-y-4 ${
          compact ? "lg:flex-1 lg:overflow-y-auto lg:min-h-0" : "max-h-[min(60vh,420px)] overflow-y-auto"
        }`}
      >
        {GLASS_CUSTOMIZER_CONTROLS.map((control) => {
          if (control.type === "toggle") {
            const checked = Boolean(config[control.key]);
            return (
              <label
                key={control.key}
                className="flex items-center justify-between gap-3 cursor-pointer"
              >
                <span className="text-xs text-zinc-300">{control.label}</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={checked}
                  onClick={() => onChange(control.key, !checked)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    checked ? "bg-white" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-zinc-950 transition-transform ${
                      checked ? "translate-x-4" : ""
                    }`}
                  />
                </button>
              </label>
            );
          }

          const value = Number(config[control.key] ?? control.min);
          return (
            <div key={control.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-zinc-300">{control.label}</label>
                <span className="text-[10px] font-mono text-zinc-500 tabular-nums">
                  {value.toFixed(control.step < 1 ? 2 : 0)}
                </span>
              </div>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                onChange={(e) => onChange(control.key, Number(e.target.value))}
                className="glass-customizer-range w-full h-1.5 rounded-full appearance-none bg-zinc-800 cursor-pointer"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
