/**
 * Default configuration values for the liquid glass effect.
 * These can be overridden per-element via dataset.config (JSON string)
 * or globally via LiquidGlass.init({ defaults: { ... } }).
 */
export const DEFAULTS = {
	/** Amount of background blur behind the glass (0 = none, 1 = maximum) */
	blurAmount: 0.00,
	/** Frost/frosted-glass intensity (0 = clear, 1 = fully frosted) */
	frostAmount: 1.00,
	/** Refraction strength — how much the glass bends the image behind it */
	refraction: 0.69,
	/** Chromatic aberration — color fringing at edges */
	chromAberration: 0.05,
	/** Edge highlight intensity (inner glow / rim lighting) */
	edgeHighlight: 0.05,
	/** Specular highlight intensity (Blinn-Phong) */
	specular: 0.00,
	/** Fresnel reflection intensity at grazing angles */
	fresnel: 1.00,
	/** Micro-distortion noise strength */
	distortion: 0.00,
	/** Corner radius in CSS pixels */
	cornerRadius: 65,
	/** Z-radius (bevel depth) — controls the curvature of the pill bevel */
	zRadius: 40,
	/** Overall opacity of the glass panel */
	opacity: 1.00,
	/** Saturation adjustment (-1 = desaturated, 0 = normal, 1 = vivid) */
	saturation: 0.00,
	/** Tint strength — cool blue-ish glass tint */
	tintStrength: 0.00,
	/** Brightness adjustment (-0.5 to 0.5) */
	brightness: 0.00,
	/** Shadow opacity (0 = no shadow, 1 = full black) */
	shadowOpacity: 0.30,
	/** Shadow spread in CSS pixels */
	shadowSpread: 10,
	/** Shadow vertical offset in CSS pixels */
	shadowOffsetY: 1,
	/** Whether this glass element can be dragged around (Pointer Events) */
	floating: false,
};

/** Number of Gaussian blur passes (higher = smoother but slower) */
export const BLUR_ITERATIONS = 6;

/** Extra padding around each panel for rendering the drop shadow (px) */
export const SHADOW_PAD = 60;
