export type GlassControlDef =
  | {
      key: string;
      label: string;
      type: "range";
      min: number;
      max: number;
      step: number;
    }
  | {
      key: string;
      label: string;
      type: "toggle";
    };

export const GLASS_CUSTOMIZER_CONTROLS: GlassControlDef[] = [
  { key: "blurAmount", label: "Blur", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "refraction", label: "Refraction", type: "range", min: 0, max: 2, step: 0.01 },
  { key: "chromAberration", label: "Chromatic aberration", type: "range", min: 0, max: 0.3, step: 0.01 },
  { key: "edgeHighlight", label: "Edge highlight", type: "range", min: 0, max: 0.5, step: 0.01 },
  { key: "specular", label: "Specular", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "fresnel", label: "Fresnel", type: "range", min: 0, max: 2, step: 0.05 },
  { key: "cornerRadius", label: "Corner radius", type: "range", min: 0, max: 80, step: 1 },
  { key: "brightness", label: "Brightness", type: "range", min: -0.5, max: 0.5, step: 0.01 },
  { key: "saturation", label: "Saturation", type: "range", min: -1, max: 1, step: 0.01 },
  { key: "tintStrength", label: "Tint", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "shadowOpacity", label: "Shadow opacity", type: "range", min: 0, max: 1, step: 0.01 },
  { key: "shadowSpread", label: "Shadow spread", type: "range", min: 0, max: 30, step: 1 },
  { key: "floating", label: "Floating (draggable)", type: "toggle" },
  { key: "button", label: "Button mode", type: "toggle" },
];

export function mergeGlassConfig(
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> {
  return { ...base, ...override };
}
