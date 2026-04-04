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
	/** Use experimental html-in-canvas API. */
	useHtmlInCanvas?: boolean;
}

interface DragState {
	active: boolean;
	element: HTMLElement | null;
	offsetX: number;
	offsetY: number;
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

	private readonly _drag: DragState = {
		active: false,
		element: null,
		offsetX: 0,
		offsetY: 0,
	};

	private readonly _onResize: () => void;
	private readonly _onPointerDown: (e: PointerEvent) => void;
	private readonly _onPointerMove: (e: PointerEvent) => void;
	private readonly _onPointerUp: (e: PointerEvent) => void;

	// ────────────────────────────────────────────
	// Constructor (prefer LiquidGlass.init)
	// ────────────────────────────────────────────

	constructor({ root, glassElements, defaults = {}, useHtmlInCanvas = false }: LiquidGlassOptions) {
		if (!root) throw new Error('LiquidGlass: `root` element is required.');

		this.root = root;
		this.defaults = { ...DEFAULTS, ...defaults };
		this.glassSet = new Set(Array.from(glassElements || []));
		this.glassCanvases = new Map();
		this.capture = new HtmlCapture(root, useHtmlInCanvas);
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
		this._setupGlassElements();
		this._hasDynamic = this._detectDynamic();
		this._sortedChildren = this._getSortedChildren();
		this._handleResize();

		await this._captureGlassContent();

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
		}
		this.glassCanvases.clear();
		this._glassCache.clear();
		this._glassContentImages.clear();
		this._glassLastSize.clear();

		this.capture.destroy();
		this.renderer.destroy();
	}

	// ────────────────────────────────────────────
	// Glass element setup
	// ────────────────────────────────────────────

	private _setupGlassElements(): void {
		for (const el of this.glassSet) {
			if (el.parentElement !== this.root) {
				console.warn('LiquidGlass: glass element is not a direct child of root, skipping.', el);
				this.glassSet.delete(el);
				continue;
			}

			const currentPosition = window.getComputedStyle(el).position;
			if (currentPosition === 'static') {
				el.style.position = 'relative';
			}
			el.style.overflow = 'visible';

			const canvas = document.createElement('canvas');
			canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
			el.insertBefore(canvas, el.firstChild);

			this.glassCanvases.set(el, canvas);
		}
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

	// ────────────────────────────────────────────
	// Child ordering & stacking context
	// ────────────────────────────────────────────

	private _getSortedChildren(): HTMLElement[] {
		const children = Array.from(this.root.children) as HTMLElement[];

		const tagged = children.map((el, domIndex) => {
			const style = window.getComputedStyle(el);
			const positioned = style.position !== 'static';
			const zIndex = positioned ? parseInt(style.zIndex, 10) || 0 : 0;
			return { el, domIndex, positioned, zIndex };
		});

		tagged.sort((a, b) => {
			if (!a.positioned && b.positioned) return -1;
			if (a.positioned && !b.positioned) return 1;
			if (a.positioned && b.positioned) {
				if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
			}
			return a.domIndex - b.domIndex;
		});

		return tagged.map(t => t.el);
	}

	private _detectDynamic(): boolean {
		for (const child of Array.from(this.root.children) as HTMLElement[]) {
			if (!this.glassSet.has(child) && child.hasAttribute('data-dynamic')) {
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

		return { ...this.defaults, ...(cachedEl.configCache || {}) };
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
		const elRect = el.getBoundingClientRect();
		const padW = SHADOW_PAD * 2;
		const padH = SHADOW_PAD * 2;
		canvas.width = Math.round((elRect.width + padW) * dpr);
		canvas.height = Math.round((elRect.height + padH) * dpr);
		canvas.style.cssText = [
			'position:absolute',
			`left:${-SHADOW_PAD}px`,
			`top:${-SHADOW_PAD}px`,
			`width:${elRect.width + padW}px`,
			`height:${elRect.height + padH}px`,
			'pointer-events:none',
		].join(';') + ';';
		this._glassLastSize.set(el, { w: elRect.width, h: elRect.height });
	}

	private _checkGlassSizeChanges(): boolean {
		let changed = false;
		for (const el of this.glassSet) {
			const elRect = el.getBoundingClientRect();
			const last = this._glassLastSize.get(el);
			if (!last
				|| Math.abs(last.w - elRect.width) > 0.5
				|| Math.abs(last.h - elRect.height) > 0.5
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

	private _handlePointerDown(e: PointerEvent): void {
		for (let i = this._sortedChildren.length - 1; i >= 0; i--) {
			const el = this._sortedChildren[i];
			if (!this.glassSet.has(el)) continue;

			const config = this._getConfig(el);
			if (!config.floating) continue;

			const rect = el.getBoundingClientRect();
			if (
				e.clientX >= rect.left && e.clientX <= rect.right &&
				e.clientY >= rect.top && e.clientY <= rect.bottom
			) {
				const rootRect = this.root.getBoundingClientRect();
				el.style.transform = 'none';
				el.style.right = 'auto';
				el.style.bottom = 'auto';
				el.style.left = (rect.left - rootRect.left) + 'px';
				el.style.top = (rect.top - rootRect.top) + 'px';

				this._drag.active = true;
				this._drag.element = el;
				this._drag.offsetX = e.clientX - rect.left;
				this._drag.offsetY = e.clientY - rect.top;
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
				if (
					e.clientX >= rect.left && e.clientX <= rect.right &&
					e.clientY >= rect.top && e.clientY <= rect.bottom
				) {
					el.style.cursor = 'grab';
				} else {
					el.style.cursor = '';
				}
			}
			return;
		}

		const el = this._drag.element!;
		const rootRect = this.root.getBoundingClientRect();
		const newLeft = e.clientX - rootRect.left - this._drag.offsetX;
		const newTop = e.clientY - rootRect.top - this._drag.offsetY;

		el.style.left = newLeft + 'px';
		el.style.top = newTop + 'px';

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
				// ── Glass element ──────────────────────────────────
				const config = this._getConfig(child);
				const elRect = child.getBoundingClientRect();
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
						elRect.width,
						elRect.height,
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

			} else {
				// ── Non-glass element ─────────────────────────────
				const isDynamic = child.hasAttribute('data-dynamic');
				const tag = child.tagName;

				if (tag === 'CANVAS' || tag === 'IMG' || tag === 'VIDEO') {
					const r = child.getBoundingClientRect();
					const dx = (r.left - rootRect.left) * dpr;
					const dy = (r.top - rootRect.top) * dpr;
					const dw = r.width * dpr;
					const dh = r.height * dpr;

					if (tag === 'CANVAS') {
						this.capture.ctx.drawImage(child as HTMLCanvasElement, dx, dy, dw, dh);
					} else {
						const mediaEl = child as HTMLImageElement | HTMLVideoElement;
						const natW = 'naturalWidth' in mediaEl
							? (mediaEl as HTMLImageElement).naturalWidth
							: (mediaEl as HTMLVideoElement).videoWidth;
						const natH = 'naturalHeight' in mediaEl
							? (mediaEl as HTMLImageElement).naturalHeight
							: (mediaEl as HTMLVideoElement).videoHeight;

						if (natW && natH) {
							const computed = getComputedStyle(child);
							const fit = computed.objectFit || 'fill';
							const pos = computed.objectPosition || '50% 50%';

							const src = LiquidGlass._objectFitRect(
								natW, natH, r.width, r.height, fit, pos,
							);
							this.capture.ctx.drawImage(
								mediaEl,
								src.sx, src.sy, src.sw, src.sh,
								dx, dy, dw, dh,
							);
						} else {
							this.capture.ctx.drawImage(mediaEl, dx, dy, dw, dh);
						}
					}
					if (isDynamic) bgChanged = true;
				} else if (!isDynamic) {
					if (!this.capture.blitFromCache(child)) {
						this.capture.captureElement(child, false);
						this._dirty = true;
					}
				} else {
					this.capture.captureElement(child, true);
					bgChanged = true;
				}
			}
		}

		if (this._dirty) {
			this._dirty = false;
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
