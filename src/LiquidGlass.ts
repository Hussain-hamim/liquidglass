/**
 * LiquidGlass — main orchestrator for the liquid glass effect library.
 *
 * Coordinates between:
 *   - HtmlCapture  (renders DOM elements onto a hidden 2D canvas)
 *   - GlassRenderer (WebGL pipeline for the glass effect)
 *
 * Handles child ordering, layered compositing, floating (drag)
 * behaviour, resize, and the render loop.
 *
 * Usage:
 *   import { LiquidGlass } from 'liquid-glass';
 *   LiquidGlass.init({ root, glassElements });
 */

import { DEFAULTS, SHADOW_PAD } from './defaults.js';
import type { GlassConfig } from './defaults.js';
import { HtmlCapture } from './HtmlCapture.js';
import { GlassRenderer } from './GlassRenderer.js';

/** Options accepted by {@link LiquidGlass.init}. */
export interface LiquidGlassOptions {
	/** Root container element. */
	root: HTMLElement;
	/** Elements to apply the glass effect to. */
	glassElements?: NodeListOf<HTMLElement> | HTMLElement[];
	/** Override the default configuration values. */
	defaults?: Partial<GlassConfig>;
}

interface DragState {
	active: boolean;
	element: HTMLElement | null;
	startX: number;
	startY: number;
	origTx: number;
	origTy: number;
}

interface GlassCacheEntry {
	centerX: number;
	centerY: number;
}

interface ConfigCachedElement extends HTMLElement {
	configCache?: Partial<GlassConfig>;
	configCacheKey?: string;
}

interface SizeEntry {
	w: number;
	h: number;
}

interface ObjectFitRect {
	sx: number;
	sy: number;
	sw: number;
	sh: number;
}

const BUTTON_CLASS = 'liquid-glass-button';
const STYLE_ID = 'liquid-glass-button-styles';
const BUTTON_CSS = `
.${BUTTON_CLASS} {
	cursor: pointer;
}
`;

interface ButtonState {
	hover: boolean;
	pressed: boolean;
}

export class LiquidGlass {
	// ────────────────────────────────────────────
	// Static entry point
	// ────────────────────────────────────────────

	static async init(options: LiquidGlassOptions): Promise<LiquidGlass> {
		const instance = new LiquidGlass(options);
		await instance._start();
		return instance;
	}

	// ────────────────────────────────────────────
	// Instance fields
	// ────────────────────────────────────────────

	readonly root: HTMLElement;
	readonly defaults: GlassConfig;
	readonly glassSet: Set<HTMLElement>;
	readonly glassCanvases: Map<HTMLElement, HTMLCanvasElement>;
	readonly capture: HtmlCapture;
	readonly renderer: GlassRenderer;

	/** Current frames-per-second (updated every frame). */
	fps = 0;

	private _running = false;
	private _rafId = 0;
	private _hasDynamic = false;
	private _dirty = true;
	private _capturingGlassContent = false;
	private _glassContentDirty = false;
	private _fpsFrames = 0;
	private _fpsTime = 0;

	private _observer: MutationObserver | null = null;
	private _glassSubtreeObserver: MutationObserver | null = null;

	private _sortedChildren: HTMLElement[] = [];
	private readonly _glassCache = new Map<HTMLElement, GlassCacheEntry>();
	private readonly _glassContentImages = new Map<HTMLElement, HTMLCanvasElement>();
	private readonly _glassLastSize = new Map<HTMLElement, SizeEntry>();
	private readonly _buttonStates = new Map<HTMLElement, ButtonState>();
	private readonly _buttonListeners = new Map<HTMLElement, Array<() => void>>();

	private readonly _drag: DragState = {
		active: false,
		element: null,
		startX: 0,
		startY: 0,
		origTx: 0,
		origTy: 0,
	};

	private readonly _onResize: () => void;
	private readonly _onPointerDown: (e: PointerEvent) => void;
	private readonly _onPointerMove: (e: PointerEvent) => void;
	private readonly _onPointerUp: (e: PointerEvent) => void;

	// ────────────────────────────────────────────
	// Constructor (prefer LiquidGlass.init)
	// ────────────────────────────────────────────

	constructor({ root, glassElements, defaults = {} }: LiquidGlassOptions) {
		if (!root) throw new Error('LiquidGlass: `root` element is required.');

		this.root = root;
		this.defaults = { ...DEFAULTS, ...defaults };
		this.glassSet = new Set(Array.from(glassElements || []));
		this.glassCanvases = new Map();
		this.capture = new HtmlCapture(root);
		// When an async html-to-image re-capture finishes, mark dirty
		// so the next frame picks up the refreshed cache. Without this,
		// pages with no dynamic content would never re-render after a
		// stale cache was refreshed in the background.
		this.capture.onCacheUpdate = () => { this._dirty = true; };
		this.renderer = new GlassRenderer();

		// When the WebGL context is restored, invalidate all caches so
		// the render loop rebuilds everything on the next frame.
		this.renderer.canvas.addEventListener('webglcontextrestored', () => {
			this._glassCache.clear();
			this._dirty = true;
		});

		this._onResize = this._handleResize.bind(this);
		this._onPointerDown = this._handlePointerDown.bind(this);
		this._onPointerMove = this._handlePointerMove.bind(this);
		this._onPointerUp = this._handlePointerUp.bind(this);
	}

	// ────────────────────────────────────────────
	// Lifecycle
	// ────────────────────────────────────────────

	private async _start(): Promise<void> {
		this.root.style.userSelect = 'none';
		(this.root.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';
		this._setupGlassElements();
		this._hasDynamic = this._detectDynamic();
		this._sortedChildren = this._getSortedChildren();
		this._handleResize();

		// Resolve the page's @font-face rules to base64 data URLs once
		// up front, so every subsequent html-to-image capture renders
		// text with the page's actual webfont (matching glyph metrics
		// with the live DOM under the glass).
		await this.capture.prefetchFontEmbedCSS();

		await this._captureGlassContent();
		// Pre-warm the static-content cache so the first rendered frame
		// has real DOM behind every glass panel — without this, the
		// shader briefly samples the empty (white) compositing canvas
		// while async html-to-image captures resolve.
		await this._prewarmStaticCaptures();

		window.addEventListener('resize', this._onResize);
		this.root.addEventListener('pointerdown', this._onPointerDown);
		window.addEventListener('pointermove', this._onPointerMove);
		window.addEventListener('pointerup', this._onPointerUp);

		this._observer = new MutationObserver(() => {
			this._sortedChildren = this._getSortedChildren();
			this._dirty = true;
		});
		this._observer.observe(this.root, { childList: true });

		this._glassSubtreeObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'attributes' && mutation.attributeName === 'data-config') {
					this._dirty = true;
					continue;
				}
				this._glassContentDirty = true;
			}
		});
		for (const el of this.glassSet) {
			this._glassSubtreeObserver.observe(el, {
				childList: true,
				subtree: true,
				characterData: true,
				attributes: true,
				attributeFilter: ['data-config'],
			});
		}
		this._glassContentDirty = false;

		this._running = true;
		this._dirty = true;
		this._rafId = requestAnimationFrame(() => this._renderLoop());
	}

	destroy(): void {
		this._running = false;
		cancelAnimationFrame(this._rafId);

		this.root.style.removeProperty('user-select');
		this.root.style.removeProperty('-webkit-user-select');

		window.removeEventListener('resize', this._onResize);
		this.root.removeEventListener('pointerdown', this._onPointerDown);
		window.removeEventListener('pointermove', this._onPointerMove);
		window.removeEventListener('pointerup', this._onPointerUp);

		this._observer?.disconnect();
		this._observer = null;
		this._glassSubtreeObserver?.disconnect();
		this._glassSubtreeObserver = null;

		for (const [el, canvas] of this.glassCanvases) {
			canvas.remove();
			el.style.removeProperty('position');
			el.style.removeProperty('overflow');
			el.style.removeProperty('touch-action');
			el.classList.remove(BUTTON_CLASS);
		}
		this.glassCanvases.clear();
		this._glassCache.clear();
		this._glassContentImages.clear();
		this._glassLastSize.clear();

		for (const removers of this._buttonListeners.values()) {
			for (const r of removers) r();
		}
		this._buttonListeners.clear();
		this._buttonStates.clear();

		document.getElementById(STYLE_ID)?.remove();

		this.capture.destroy();
		this.renderer.destroy();
	}

	// ────────────────────────────────────────────
	// Glass element setup
	// ────────────────────────────────────────────

	private _setupGlassElements(): void {
		let needsButtonStyles = false;

		for (const el of this.glassSet) {
			// Glass elements must be direct children of the root.
			if (el.parentElement !== this.root) {
				console.warn('LiquidGlass: glass element must be a direct child of root, skipping.', el);
				this.glassSet.delete(el);
				continue;
			}

			const currentPosition = window.getComputedStyle(el).position;
			if (currentPosition === 'static') {
				el.style.position = 'relative';
			}
			el.style.overflow = 'visible';

			const config = this._getConfig(el);

			// Prevent browser from hijacking pointer events for
			// scroll/pan on floating (draggable) glass elements.
			if (config.floating) {
				el.style.touchAction = 'none';
			}

			// Button mode — cursor + hover/press shader-state listeners
			if (config.button) {
				el.classList.add(BUTTON_CLASS);
				needsButtonStyles = true;
				this._setupButtonListeners(el);
			}

			const canvas = document.createElement('canvas');
			canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
			el.insertBefore(canvas, el.firstChild);

			this.glassCanvases.set(el, canvas);
		}

		// Inject button styles once if any glass element uses button mode
		if (needsButtonStyles && !document.getElementById(STYLE_ID)) {
			const style = document.createElement('style');
			style.id = STYLE_ID;
			style.textContent = BUTTON_CSS;
			document.head.appendChild(style);
		}

	}

	private _setupButtonListeners(el: HTMLElement): void {
		const state: ButtonState = { hover: false, pressed: false };
		this._buttonStates.set(el, state);

		const onOver = () => { state.hover = true; this._dirty = true; };
		const onOut = () => { state.hover = false; state.pressed = false; this._dirty = true; };
		const onDown = () => { state.pressed = true; this._dirty = true; };
		const onUp = () => { state.pressed = false; this._dirty = true; };

		el.addEventListener('pointerover', onOver);
		el.addEventListener('pointerout', onOut);
		el.addEventListener('pointerdown', onDown);
		el.addEventListener('pointerup', onUp);
		el.addEventListener('pointercancel', onUp);

		this._buttonListeners.set(el, [
			() => el.removeEventListener('pointerover', onOver),
			() => el.removeEventListener('pointerout', onOut),
			() => el.removeEventListener('pointerdown', onDown),
			() => el.removeEventListener('pointerup', onUp),
			() => el.removeEventListener('pointercancel', onUp),
		]);
	}

	// ────────────────────────────────────────────
	// Glass content pre-capture
	// ────────────────────────────────────────────

	/**
	 * Pre-capture each glass element's DOM content (text, icons, etc.)
	 * into a standalone canvas, hiding the injected shader canvas so
	 * it isn't included.
	 *
	 * Guarded against concurrent execution: if a capture is already in
	 * progress, the flag is re-set so a fresh capture runs after the
	 * current one completes.
	 */
	private async _captureGlassContent(): Promise<void> {
		if (this._capturingGlassContent) {
			this._glassContentDirty = true;
			return;
		}
		this._capturingGlassContent = true;
		try {
			for (const [el, glassCanvas] of this.glassCanvases) {
				const rect = el.getBoundingClientRect();
				const img = await this.capture.captureToCanvas(
					el,
					rect.width,
					rect.height,
					[glassCanvas],
				);
				if (img) {
					this._glassContentImages.set(el, img);
				}
			}
		} finally {
			this._capturingGlassContent = false;
		}
	}

	/**
	 * Synchronously walk every non-glass direct child of root and
	 * await its html-to-image capture so the cache is fully populated
	 * by the time the render loop starts. Without this, the first
	 * frame's glass shader sees the empty (white) compositing canvas
	 * for ~one or two frames while the async captures resolve.
	 */
	private async _prewarmStaticCaptures(): Promise<void> {
		for (const child of this._sortedChildren) {
			if (this.glassSet.has(child)) continue;
			const tag = child.tagName;
			if (tag === 'CANVAS' || tag === 'IMG' || tag === 'VIDEO') continue;
			if (child.hasAttribute('data-dynamic')) continue;
			try {
				await this.capture.captureElement(child, false);
			} catch (err) {
				console.warn('LiquidGlass: prewarm capture failed:', child, err);
			}
		}
	}

	// ────────────────────────────────────────────
	// Child ordering & stacking context
	// ────────────────────────────────────────────

	private _getSortedChildren(): HTMLElement[] {
		const children = Array.from(this.root.children) as HTMLElement[];
		const rootDisplay = window.getComputedStyle(this.root).display;
		const isFlexOrGridParent =
			rootDisplay === 'flex' || rootDisplay === 'inline-flex' ||
			rootDisplay === 'grid' || rootDisplay === 'inline-grid';

		const tagged = children.map((el, domIndex) => {
			const style = window.getComputedStyle(el);
			const hasStackingContext =
				LiquidGlass._formsStackingContext(style, isFlexOrGridParent);
			const rawZ = parseInt(style.zIndex, 10);
			const zIndex = isNaN(rawZ) ? 0 : rawZ;
			return { el, domIndex, hasStackingContext, zIndex };
		});

		tagged.sort((a, b) => {
			if (!a.hasStackingContext && b.hasStackingContext) return -1;
			if (a.hasStackingContext && !b.hasStackingContext) return 1;
			if (a.hasStackingContext && b.hasStackingContext) {
				if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
			}
			return a.domIndex - b.domIndex;
		});

		return tagged.map(t => t.el);
	}

	/**
	 * Returns true when the element forms a CSS stacking context — i.e.
	 * when its z-index participates in painting order. Mirrors the spec:
	 * https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_positioned_layout/Stacking_context
	 *
	 * Used by `_getSortedChildren` to decide painting order on the
	 * compositing canvas. The set of triggers needs to match the
	 * browser's actual stacking model — otherwise overlays end up
	 * painted before the background image and get erased.
	 */
	private static _formsStackingContext(
		style: CSSStyleDeclaration,
		isFlexOrGridParent: boolean,
	): boolean {
		if (style.position !== 'static') return true;
		if (isFlexOrGridParent && style.zIndex !== 'auto') return true;
		if (parseFloat(style.opacity) < 1) return true;
		if (style.transform !== 'none' && style.transform !== '') return true;
		if (style.filter !== 'none' && style.filter !== '') return true;
		if (style.perspective !== 'none' && style.perspective !== '') return true;
		if (style.clipPath !== 'none' && style.clipPath !== '') return true;
		if (style.mixBlendMode !== 'normal' && style.mixBlendMode !== '') return true;
		if (style.isolation === 'isolate') return true;

		const bf = style.backdropFilter
			|| (style as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter;
		if (bf && bf !== 'none') return true;

		const mask = style.maskImage
			|| (style as unknown as { webkitMaskImage?: string }).webkitMaskImage;
		if (mask && mask !== 'none') return true;

		const contain = style.contain;
		if (contain && /\b(layout|paint|strict|content)\b/.test(contain)) return true;

		if (style.willChange) {
			const triggers = new Set([
				'transform', 'opacity', 'filter', 'backdrop-filter',
				'perspective', 'clip-path', 'mask', 'mask-image',
				'isolation', 'mix-blend-mode',
			]);
			const tokens = style.willChange.split(',').map(t => t.trim());
			for (const t of tokens) {
				if (triggers.has(t)) return true;
			}
		}

		return false;
	}

	private _detectDynamic(): boolean {
		// Check the entire subtree for data-dynamic elements
		// (video with data-dynamic, etc.).
		const dynEls = this.root.querySelectorAll('[data-dynamic]');
		for (const el of dynEls) {
			if (!this.glassSet.has(el as HTMLElement)) {
				return true;
			}
		}
		// Also: any video element is implicitly dynamic (live frames).
		const videos = this.root.querySelectorAll('video');
		for (const vid of videos) {
			if (!this.glassSet.has(vid as unknown as HTMLElement)) {
				return true;
			}
		}
		return false;
	}

	// ────────────────────────────────────────────
	// Configuration
	// ────────────────────────────────────────────

	private _getConfig(el: HTMLElement): GlassConfig {
		const cachedEl = el as ConfigCachedElement;
		const configKey = el.dataset.config ?? '';

		if (cachedEl.configCacheKey !== configKey) {
			let perElement: Partial<GlassConfig> = {};
			if (configKey) {
				try {
					const parsed = JSON.parse(configKey);
					if (parsed && typeof parsed === 'object') {
						perElement = parsed as Partial<GlassConfig>;
					} else {
						console.warn('LiquidGlass: data-config must decode to an object for element:', el);
					}
				} catch (_e) {
					console.warn('LiquidGlass: invalid JSON in data-config for element:', el);
				}
			}
			cachedEl.configCache = perElement;
			cachedEl.configCacheKey = configKey;
		}

		const config = { ...this.defaults, ...(cachedEl.configCache || {}) };

		if (config.button) {
			const state = this._buttonStates.get(el);
			if (state) {
				if (state.pressed) {
					config.zRadius = config.zRadius * 0.8;
					config.shadowSpread = config.shadowSpread * 1.2;
					// brightness reset to original (no hover boost)
				} else if (state.hover) {
					config.brightness = config.brightness + 0.2;
				}
			}
		}

		return config;
	}

	// ────────────────────────────────────────────
	// Resize
	// ────────────────────────────────────────────

	private _handleResize(): void {
		const dpr = window.devicePixelRatio || 1;
		const rect = this.root.getBoundingClientRect();
		const w = Math.round(rect.width * dpr);
		const h = Math.round(rect.height * dpr);

		this.capture.resize(w, h, dpr);
		this.renderer.resize(w, h);

		for (const el of this.glassSet) {
			this._updateGlassCanvasSize(el);
		}

		this._glassCache.clear();
		this._glassContentDirty = true;
		this._dirty = true;
	}

	private _updateGlassCanvasSize(el: HTMLElement): void {
		const canvas = this.glassCanvases.get(el);
		if (!canvas) return;
		const dpr = window.devicePixelRatio || 1;
		// Use offsetWidth/Height — the CSS box size before transforms.
		// This prevents button hover scale from inflating the canvas.
		const elW = el.offsetWidth;
		const elH = el.offsetHeight;
		const padW = SHADOW_PAD * 2;
		const padH = SHADOW_PAD * 2;
		canvas.width = Math.round((elW + padW) * dpr);
		canvas.height = Math.round((elH + padH) * dpr);
		canvas.style.cssText = [
			'position:absolute',
			`left:${-SHADOW_PAD}px`,
			`top:${-SHADOW_PAD}px`,
			`width:${elW + padW}px`,
			`height:${elH + padH}px`,
			'pointer-events:none',
		].join(';') + ';';
		this._glassLastSize.set(el, { w: elW, h: elH });
	}

	private _checkGlassSizeChanges(): boolean {
		let changed = false;
		for (const el of this.glassSet) {
			// Use offsetWidth/Height instead of getBoundingClientRect so
			// CSS transforms (e.g. button hover scale) don't trigger
			// false size-change detections and render loops.
			const w = el.offsetWidth;
			const h = el.offsetHeight;
			const last = this._glassLastSize.get(el);
			if (!last
				|| Math.abs(last.w - w) > 0.5
				|| Math.abs(last.h - h) > 0.5
			) {
				this._updateGlassCanvasSize(el);
				this._glassCache.delete(el);
				this.capture.invalidateCache(el);
				changed = true;
			}
		}
		if (changed) {
			this._glassContentDirty = true;
		}
		return changed;
	}

	// ────────────────────────────────────────────
	// Floating (drag) behaviour — Pointer Events
	// ────────────────────────────────────────────

	/** Parse the current translate(x, y) values from an element's transform. */
	private static _getTranslateXY(el: HTMLElement): [number, number] {
		const style = getComputedStyle(el);
		const matrix = style.transform;
		if (!matrix || matrix === 'none') return [0, 0];
		// matrix(a, b, c, d, tx, ty)
		const m = matrix.match(/matrix\(([^)]+)\)/);
		if (m) {
			const parts = m[1].split(',').map(Number);
			return [parts[4] || 0, parts[5] || 0];
		}
		return [0, 0];
	}

	private _handlePointerDown(e: PointerEvent): void {
		// Iterate all glass elements in reverse stacking order (topmost first).
		for (let i = this._sortedChildren.length - 1; i >= 0; i--) {
			const el = this._sortedChildren[i];
			if (!this.glassSet.has(el)) continue;

			const config = this._getConfig(el);
			if (!config.floating) continue;

			const rect = el.getBoundingClientRect();
			// Use the CSS box size (offsetWidth/Height) for hit testing,
			// but use the bounding rect position (which is correct for
			// elements positioned via CSS, grid, etc.).
			const elW = el.offsetWidth;
			const elH = el.offsetHeight;
			// The visual position includes the shadow canvas overflow.
			// Compute the element's true visual origin by centering the
			// offset size within the bounding rect.
			const visualLeft = rect.left + (rect.width - elW) / 2;
			const visualTop = rect.top + (rect.height - elH) / 2;

			if (
				e.clientX >= visualLeft && e.clientX <= visualLeft + elW &&
				e.clientY >= visualTop && e.clientY <= visualTop + elH
			) {
				const [tx, ty] = LiquidGlass._getTranslateXY(el);
				this._drag.active = true;
				this._drag.element = el;
				this._drag.startX = e.clientX;
				this._drag.startY = e.clientY;
				this._drag.origTx = tx;
				this._drag.origTy = ty;
				el.style.cursor = 'grabbing';
				el.setPointerCapture(e.pointerId);
				e.preventDefault();
				break;
			}
		}
	}

	private _handlePointerMove(e: PointerEvent): void {
		if (!this._drag.active) {
			for (const el of this.glassSet) {
				const config = this._getConfig(el);
				if (!config.floating) continue;
				const rect = el.getBoundingClientRect();
				const elW = el.offsetWidth;
				const elH = el.offsetHeight;
				const visualLeft = rect.left + (rect.width - elW) / 2;
				const visualTop = rect.top + (rect.height - elH) / 2;
				if (
					e.clientX >= visualLeft && e.clientX <= visualLeft + elW &&
					e.clientY >= visualTop && e.clientY <= visualTop + elH
				) {
					el.style.cursor = 'grab';
				} else {
					el.style.cursor = '';
				}
			}
			return;
		}

		const el = this._drag.element!;
		const dx = e.clientX - this._drag.startX;
		const dy = e.clientY - this._drag.startY;
		let newTx = this._drag.origTx + dx;
		let newTy = this._drag.origTy + dy;

		// Constrain within root bounds with margin.
		// For nested elements, offsetLeft/Top is relative to offsetParent
		// (which may not be root). Use getBoundingClientRect to compute
		// the element's position relative to root, then subtract the
		// current translate to get the base (CSS layout) position.
		const rootRect = this.root.getBoundingClientRect();
		const elW = el.offsetWidth;
		const elH = el.offsetHeight;
		const elRect = el.getBoundingClientRect();
		const [curTx, curTy] = LiquidGlass._getTranslateXY(el);
		const baseLeft = (elRect.left + (elRect.width - elW) / 2) - rootRect.left - curTx;
		const baseTop = (elRect.top + (elRect.height - elH) / 2) - rootRect.top - curTy;
		const margin = 10;
		const posLeft = baseLeft + newTx;
		const posTop = baseTop + newTy;
		const maxLeft = rootRect.width - elW - margin;
		const maxTop = rootRect.height - elH - margin;
		if (posLeft < margin) newTx += margin - posLeft;
		if (posTop < margin) newTy += margin - posTop;
		if (posLeft > maxLeft) newTx -= posLeft - maxLeft;
		if (posTop > maxTop) newTy -= posTop - maxTop;

		el.style.transform = `translate(${newTx}px, ${newTy}px)`;

		this._dirty = true;
	}

	private _handlePointerUp(_e: PointerEvent): void {
		if (!this._drag.active) return;
		this._drag.element!.style.cursor = '';
		this._drag.active = false;
		this._drag.element = null;
		this._dirty = true;
	}

	// ────────────────────────────────────────────
	// Render loop
	// ────────────────────────────────────────────

	private _renderLoop(): void {
		if (!this._running) return;

		// FPS tracking
		const now = performance.now();
		this._fpsFrames++;
		if (now - this._fpsTime >= 1000) {
			this.fps = this._fpsFrames;
			this._fpsFrames = 0;
			this._fpsTime = now;
		}

		if (this._checkGlassSizeChanges()) {
			this._dirty = true;
		}

		if (this._glassContentDirty) {
			this._glassContentDirty = false;
			this._captureGlassContent();
		}

		try {
			this._renderFrame();
		} catch (err) {
			console.error('LiquidGlass: render error:', err);
		}

		this._rafId = requestAnimationFrame(() => this._renderLoop());
	}

	private _renderFrame(): void {
		const dpr = window.devicePixelRatio || 1;
		const rootRect = this.root.getBoundingClientRect();
		const isDragging = this._drag.active;

		const needsRender = this._dirty || this._hasDynamic || isDragging;
		if (!needsRender) return;

		this.capture.clear();

		let bgChanged = this._dirty;

		for (const child of this._sortedChildren) {
			if (this.glassSet.has(child)) {
				bgChanged = this._renderGlassElement(child, rootRect, dpr, isDragging, bgChanged);
			} else {
				bgChanged = this._captureNonGlassChild(child, rootRect, dpr, bgChanged);
			}
		}

		if (this._dirty) {
			this._dirty = false;
		}
	}

	/**
	 * Render a single glass element: run the shader if needed,
	 * composite it onto the hidden canvas, then blit its content image.
	 * Returns the updated bgChanged flag.
	 */
	private _renderGlassElement(
		child: HTMLElement,
		rootRect: DOMRect,
		dpr: number,
		isDragging: boolean,
		bgChanged: boolean,
	): boolean {
		const config = this._getConfig(child);
		const elRect = child.getBoundingClientRect();
		const elW = child.offsetWidth;
		const elH = child.offsetHeight;
		const centerX = (elRect.left - rootRect.left) + elRect.width / 2;
		const centerY = (elRect.top - rootRect.top) + elRect.height / 2;
		const glassCanvas = this.glassCanvases.get(child);
		const isBeingDragged = isDragging && this._drag.element === child;

		const cached = this._glassCache.get(child);
		const posChanged = !cached
			|| Math.abs(cached.centerX - centerX) > 0.5
			|| Math.abs(cached.centerY - centerY) > 0.5;

		const needsShaderRender = isDragging
			? (isBeingDragged || bgChanged)
			: (!cached || posChanged || bgChanged);

		if (needsShaderRender && glassCanvas) {
			const cropX = Math.round((elRect.left - rootRect.left - SHADOW_PAD) * dpr);
			const cropY = Math.round((elRect.top - rootRect.top - SHADOW_PAD) * dpr);
			this.renderer.uploadAndBlur(
				this.capture.canvas,
				cropX,
				cropY,
				glassCanvas.width,
				glassCanvas.height,
				config.blurAmount,
			);
			this.renderer.clear();
			this.renderer.renderGlassPanel(
				config,
				elW,
				elH,
				dpr,
			);

			const ctx = glassCanvas.getContext('2d')!;
			ctx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
			ctx.drawImage(
				this.renderer.canvas,
				0, 0, glassCanvas.width, glassCanvas.height,
				0, 0, glassCanvas.width, glassCanvas.height,
			);

			this._glassCache.set(child, { centerX, centerY });
			bgChanged = true;
		}

		// Composite glass onto hidden canvas for higher layers
		this._blitGlassShader(child, elRect, rootRect, dpr);

		const contentImg = this._glassContentImages.get(child);
		if (contentImg) {
			const cx = (elRect.left - rootRect.left) * dpr;
			const cy = (elRect.top - rootRect.top) * dpr;
			const cw = elRect.width * dpr;
			const ch = elRect.height * dpr;
			this.capture.ctx.drawImage(contentImg, cx, cy, cw, ch);
		}

		return bgChanged;
	}

	/**
	 * Capture a non-glass direct child of root onto the compositing canvas.
	 * If the child is a simple media element (img/video/canvas), draw it
	 * via the fast path. Otherwise, recursively find media elements inside
	 * it and draw them, then fall back to html-to-image for the rest.
	 * Returns the updated bgChanged flag.
	 */
	private _captureNonGlassChild(
		child: HTMLElement,
		rootRect: DOMRect,
		dpr: number,
		bgChanged: boolean,
	): boolean {
		const tag = child.tagName;

		if (tag === 'CANVAS' || tag === 'IMG' || tag === 'VIDEO') {
			// Direct-child media element — fast path
			const drew = this._drawMediaElement(child, rootRect, dpr);
			if (drew && child.hasAttribute('data-dynamic')) bgChanged = true;
			return bgChanged;
		}

		// It's a wrapper div. Draw any media descendants it contains
		// via the fast path (since html-to-image can't render video).
		const hasDynamic = this._captureMediaDescendants(child, rootRect, dpr);
		if (hasDynamic) bgChanged = true;

		// Also capture the wrapper's HTML content via html-to-image
		// (for text, styled divs, etc.). This is additive — the media
		// fast paths above already drew the video/img/canvas frames.
		// captureElement always blits any cached canvas (stretched if
		// the size has shifted), so the compositing canvas never has
		// a transparent gap at the wrapper's location while async
		// re-captures run in the background.
		const isDynamic = child.hasAttribute('data-dynamic');
		const hadCache = this.capture.cache.has(child);
		this.capture.captureElement(child, isDynamic);
		if (!hadCache) {
			this._dirty = true;
		}
		if (isDynamic) {
			bgChanged = true;
		}

		return bgChanged;
	}

	/**
	 * Recursively find and draw all img/video/canvas elements inside
	 * a wrapper, skipping any glass elements and their injected canvases.
	 * Returns true if any dynamic media was drawn.
	 */
	private _captureMediaDescendants(
		parent: HTMLElement,
		rootRect: DOMRect,
		dpr: number,
	): boolean {
		let hasDynamic = false;
		const mediaEls = parent.querySelectorAll('img, video, canvas');
		for (const el of mediaEls) {
			const htmlEl = el as HTMLElement;
			// Skip the injected glass shader canvases
			let isGlassCanvas = false;
			for (const [, gc] of this.glassCanvases) {
				if (gc === el) { isGlassCanvas = true; break; }
			}
			if (isGlassCanvas) continue;

			const drew = this._drawMediaElement(htmlEl, rootRect, dpr);
			if (drew) hasDynamic = true;
		}
		return hasDynamic;
	}

	/** Draw a single img/video/canvas onto the compositing canvas. Returns true if drawn. */
	private _drawMediaElement(
		el: HTMLElement,
		rootRect: DOMRect,
		dpr: number,
	): boolean {
		const tag = el.tagName;
		const r = el.getBoundingClientRect();
		const dx = (r.left - rootRect.left) * dpr;
		const dy = (r.top - rootRect.top) * dpr;
		const dw = r.width * dpr;
		const dh = r.height * dpr;

		// Hidden / collapsed media element — nothing to draw, but
		// drawImage with zero dimensions throws InvalidStateError, so
		// short-circuit.
		if (dw <= 0 || dh <= 0) return false;

		if (tag === 'CANVAS') {
			const liveCanvas = el as HTMLCanvasElement;
			if (liveCanvas.width <= 0 || liveCanvas.height <= 0) return false;
			this.capture.ctx.drawImage(liveCanvas, dx, dy, dw, dh);
			return true;
		} else if (tag === 'IMG') {
			const img = el as HTMLImageElement;
			if (!img.complete || img.naturalWidth === 0) return false;
			this._drawMediaFitted(img, img.naturalWidth, img.naturalHeight, el, r, dx, dy, dw, dh);
			return true;
		} else if (tag === 'VIDEO') {
			const vid = el as HTMLVideoElement;
			if (vid.readyState < 2) return false;
			this._drawMediaFitted(vid, vid.videoWidth, vid.videoHeight, el, r, dx, dy, dw, dh);
			return true;
		}
		return false;
	}

	/** Draw an img or video onto the compositing canvas, respecting object-fit. */
	private _drawMediaFitted(
		mediaEl: HTMLImageElement | HTMLVideoElement,
		natW: number,
		natH: number,
		child: HTMLElement,
		r: DOMRect,
		dx: number,
		dy: number,
		dw: number,
		dh: number,
	): void {
		if (natW && natH) {
			const computed = getComputedStyle(child);
			const fit = computed.objectFit || 'fill';
			const pos = computed.objectPosition || '50% 50%';
			const src = LiquidGlass._objectFitRect(natW, natH, r.width, r.height, fit, pos);
			this.capture.ctx.drawImage(mediaEl, src.sx, src.sy, src.sw, src.sh, dx, dy, dw, dh);
		} else {
			this.capture.ctx.drawImage(mediaEl, dx, dy, dw, dh);
		}
	}

	private _blitGlassShader(
		child: HTMLElement,
		elRect: DOMRect,
		rootRect: DOMRect,
		dpr: number,
	): void {
		const glassCanvas = this.glassCanvases.get(child);
		if (!glassCanvas) return;
		const compX = (elRect.left - rootRect.left - SHADOW_PAD) * dpr;
		const compY = (elRect.top - rootRect.top - SHADOW_PAD) * dpr;
		const compW = (elRect.width + SHADOW_PAD * 2) * dpr;
		const compH = (elRect.height + SHADOW_PAD * 2) * dpr;
		this.capture.compositeGlass(glassCanvas, compX, compY, compW, compH);
	}

	/** Compute the source rectangle for drawImage that replicates CSS object-fit / object-position. */
	static _objectFitRect(
		natW: number,
		natH: number,
		boxW: number,
		boxH: number,
		fit: string,
		pos: string,
	): ObjectFitRect {
		let sx = 0, sy = 0, sw = natW, sh = natH;

		if (fit === 'fill' || (fit === 'scale-down' && natW <= boxW && natH <= boxH)) {
			return { sx, sy, sw, sh };
		}

		const parts = pos.split(/\s+/);
		const parseFrac = (v: string, total: number): number => {
			if (v.endsWith('%')) return parseFloat(v) / 100;
			return parseFloat(v) / total;
		};
		const fx = parseFrac(parts[0] || '50%', boxW);
		const fy = parseFrac(parts[1] || '50%', boxH);

		if (fit === 'cover') {
			const scale = Math.max(boxW / natW, boxH / natH);
			sw = boxW / scale;
			sh = boxH / scale;
			sx = (natW - sw) * fx;
			sy = (natH - sh) * fy;
		} else if (fit === 'contain' || fit === 'scale-down') {
			return { sx: 0, sy: 0, sw: natW, sh: natH };
		} else if (fit === 'none') {
			sw = boxW;
			sh = boxH;
			sx = (natW - sw) * fx;
			sy = (natH - sh) * fy;
		}

		sx = Math.max(0, Math.min(sx, natW - 1));
		sy = Math.max(0, Math.min(sy, natH - 1));
		sw = Math.min(sw, natW - sx);
		sh = Math.min(sh, natH - sy);

		return { sx, sy, sw, sh };
	}
}
