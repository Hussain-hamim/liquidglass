/**
 * LiquidGlass — main orchestrator for the liquid glass effect library.
 *
 * Coordinates between:
 *   • HtmlCapture  (renders DOM elements onto a hidden 2D canvas)
 *   • GlassRenderer (WebGL pipeline for the glass effect)
 *
 * Handles child ordering, layered compositing, floating (drag)
 * behaviour, resize, and the render loop.
 *
 * Usage:
 *   import { LiquidGlass } from 'liquid-glass';
 *   LiquidGlass.init({ root, glassElements });
 */

import { DEFAULTS, SHADOW_PAD } from './defaults.js';
import { HtmlCapture } from './HtmlCapture.js';
import { GlassRenderer } from './GlassRenderer.js';

export class LiquidGlass {
	// ────────────────────────────────────────────
	// Static entry point
	// ────────────────────────────────────────────

	/**
	 * Initialise the liquid glass effect.
	 *
	 * @param {object}               options
	 * @param {HTMLElement}          options.root           Root container element.
	 * @param {NodeList|HTMLElement[]} options.glassElements Elements to apply the glass effect to.
	 * @param {object}               [options.defaults]     Override the default configuration values.
	 * @param {boolean}              [options.useHtmlInCanvas=false]  Use experimental html-in-canvas API.
	 * @returns {Promise<LiquidGlass>}  The instance (call .destroy() to tear down).
	 */
	static async init(options) {
		const instance = new LiquidGlass(options);
		await instance._start();
		return instance;
	}

	// ────────────────────────────────────────────
	// Constructor (prefer LiquidGlass.init)
	// ────────────────────────────────────────────

	constructor({ root, glassElements, defaults = {}, useHtmlInCanvas = false }) {
		if (!root) throw new Error('LiquidGlass: `root` element is required.');

		/** @type {HTMLElement} */
		this.root = root;

		/** Merged global defaults */
		this.defaults = { ...DEFAULTS, ...defaults };

		/** Set of glass elements (as provided) */
		this.glassSet = new Set(Array.from(glassElements || []));

		/** Map from glass element → its child <canvas> */
		this.glassCanvases = new Map();

		/** HTML capture system */
		this.capture = new HtmlCapture(root, useHtmlInCanvas);

		/** WebGL glass renderer */
		this.renderer = new GlassRenderer();

		/** Whether the render loop is active */
		this._running = false;

		/** Animation frame ID */
		this._rafId = 0;

		/** Bound event handlers (for cleanup) */
		this._onResize = this._handleResize.bind(this);
		this._onPointerDown = this._handlePointerDown.bind(this);
		this._onPointerMove = this._handlePointerMove.bind(this);
		this._onPointerUp = this._handlePointerUp.bind(this);

		/** Drag state for floating glass elements */
		this._drag = {
			active: false,
			element: null,
			offsetX: 0,
			offsetY: 0,
		};

		/** Flag: do we have any dynamic children? */
		this._hasDynamic = false;

		/** Flag: needs full re-capture */
		this._dirty = true;

		/** MutationObserver for DOM changes */
		this._observer = null;

		/** Cached sorted children list */
		this._sortedChildren = [];

		/**
		 * Per-glass-element shader cache.  Tracks the last rendered
		 * position so we can skip the WebGL pipeline when nothing changed.
		 * @type {Map<HTMLElement, {centerX: number, centerY: number}>}
		 */
		this._glassCache = new Map();

		/**
		 * Pre-captured DOM content for each glass element (text, icons
		 * etc. WITHOUT the injected shader canvas).  Captured once
		 * during init, re-captured only when content changes.
		 * @type {Map<HTMLElement, HTMLCanvasElement>}
		 */
		this._glassContentImages = new Map();
	}

	// ────────────────────────────────────────────
	// Lifecycle
	// ────────────────────────────────────────────

	/**
	 * Set up the DOM, event listeners, and start the render loop.
	 */
	async _start() {
		// Prepare glass elements (inject child canvases, set styles)
		this._setupGlassElements();

		// Detect dynamic children
		this._hasDynamic = this._detectDynamic();

		// Sort children by stacking order
		this._sortedChildren = this._getSortedChildren();

		// Initial sizing
		this._handleResize();

		// Pre-capture glass element DOM content (text etc.) BEFORE the
		// render loop starts.  The brief display:none on injected canvases
		// is invisible to the user since no frame has been painted yet.
		await this._captureGlassContent();

		// Bind events
		window.addEventListener('resize', this._onResize);
		this.root.addEventListener('pointerdown', this._onPointerDown);
		window.addEventListener('pointermove', this._onPointerMove);
		window.addEventListener('pointerup', this._onPointerUp);

		// Observe DOM mutations (children added/removed on root)
		this._observer = new MutationObserver(() => {
			this._sortedChildren = this._getSortedChildren();
			this._dirty = true;
		});
		this._observer.observe(this.root, { childList: true });

		// Observe subtree mutations on glass elements so we know when
		// their content changes and the pre-captured image is stale.
		this._glassSubtreeObserver = new MutationObserver(() => {
			this._glassContentDirty = true;
		});
		for (const el of this.glassSet) {
			this._glassSubtreeObserver.observe(el, {
				childList: true,
				subtree: true,
				characterData: true,
			});
		}
		this._glassContentDirty = false;

		// Start render loop
		this._running = true;
		this._dirty = true;
		this._rafId = requestAnimationFrame(() => this._renderLoop());
	}

	/**
	 * Tear down everything: stop the loop, remove event listeners,
	 * remove injected canvases, free WebGL resources.
	 */
	destroy() {
		this._running = false;
		cancelAnimationFrame(this._rafId);

		window.removeEventListener('resize', this._onResize);
		this.root.removeEventListener('pointerdown', this._onPointerDown);
		window.removeEventListener('pointermove', this._onPointerMove);
		window.removeEventListener('pointerup', this._onPointerUp);

		if (this._observer) {
			this._observer.disconnect();
			this._observer = null;
		}
		if (this._glassSubtreeObserver) {
			this._glassSubtreeObserver.disconnect();
			this._glassSubtreeObserver = null;
		}

		// Remove injected canvases and reset styles
		for (const [el, canvas] of this.glassCanvases) {
			canvas.remove();
			el.style.removeProperty('position');
			el.style.removeProperty('overflow');
		}
		this.glassCanvases.clear();
		this._glassCache.clear();
		this._glassContentImages.clear();

		this.capture.destroy();
		this.renderer.destroy();
	}

	// ────────────────────────────────────────────
	// Glass element setup
	// ────────────────────────────────────────────

	/**
	 * For each glass element, inject a child <canvas> and set
	 * positioning styles so the canvas covers the element.
	 */
	_setupGlassElements() {
		for (const el of this.glassSet) {
			// Only handle direct children of root
			if (el.parentElement !== this.root) {
				console.warn('LiquidGlass: glass element is not a direct child of root, skipping.', el);
				this.glassSet.delete(el);
				continue;
			}

			// Set positioning on the glass element so the child canvas
			// can be absolutely positioned inside it
			const currentPosition = window.getComputedStyle(el).position;
			if (currentPosition === 'static') {
				el.style.position = 'relative';
			}
			// Ensure overflow is visible so the shadow padding canvas is not clipped
			el.style.overflow = 'visible';

			// Create the child canvas
			const canvas = document.createElement('canvas');
			canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
			// Insert at the beginning so content renders above the glass effect
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
	 * This runs OUTSIDE the render loop — the brief display:none on the
	 * injected canvases is either invisible (before first paint) or
	 * imperceptible (single-shot re-capture triggered by mutation).
	 */
	async _captureGlassContent() {
		const dpr = window.devicePixelRatio || 1;
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
	}

	// ────────────────────────────────────────────
	// Child ordering & stacking context
	// ────────────────────────────────────────────

	/**
	 * Return direct children of root sorted by their visual stacking
	 * order (lowest first).
	 *
	 * Stacking rules (simplified CSS 2.1 Appendix E):
	 *   1. Non-positioned elements in DOM order (z-index auto)
	 *   2. Positioned elements, sorted by z-index then DOM order
	 *
	 * @returns {HTMLElement[]}
	 */
	_getSortedChildren() {
		const children = Array.from(this.root.children);

		// Tag each child with its stacking-relevant properties
		const tagged = children.map((el, domIndex) => {
			const style = window.getComputedStyle(el);
			const positioned = style.position !== 'static';
			const zIndex = positioned ? parseInt(style.zIndex, 10) || 0 : 0;
			return { el, domIndex, positioned, zIndex };
		});

		// Sort: non-positioned first (DOM order), then positioned (z-index, then DOM order)
		tagged.sort((a, b) => {
			// Non-positioned always below positioned
			if (!a.positioned && b.positioned) return -1;
			if (a.positioned && !b.positioned) return 1;
			// Both positioned — sort by z-index, then DOM order
			if (a.positioned && b.positioned) {
				if (a.zIndex !== b.zIndex) return a.zIndex - b.zIndex;
			}
			return a.domIndex - b.domIndex;
		});

		return tagged.map(t => t.el);
	}

	/**
	 * Check if any direct child has `data-dynamic`.
	 */
	_detectDynamic() {
		for (const child of this.root.children) {
			if (!this.glassSet.has(child) && child.hasAttribute('data-dynamic')) {
				return true;
			}
		}
		return false;
	}

	// ────────────────────────────────────────────
	// Configuration
	// ────────────────────────────────────────────

	/**
	 * Read the per-element configuration from its dataset.config,
	 * merge with global defaults, and return the result.
	 *
	 * @param {HTMLElement} el  A glass element.
	 * @returns {object}        Merged configuration.
	 */
	_getConfig(el) {
		let perElement = {};
		if (el.dataset.config) {
			try {
				perElement = JSON.parse(el.dataset.config);
			} catch (_e) {
				console.warn('LiquidGlass: invalid JSON in data-config for element:', el);
			}
		}
		return { ...this.defaults, ...perElement };
	}

	// ────────────────────────────────────────────
	// Resize
	// ────────────────────────────────────────────

	_handleResize() {
		const dpr = window.devicePixelRatio || 1;
		const rect = this.root.getBoundingClientRect();
		const w = Math.round(rect.width * dpr);
		const h = Math.round(rect.height * dpr);

		this.capture.resize(w, h, dpr);
		this.renderer.resize(w, h);

		// Resize each glass element's canvas
		for (const [el, canvas] of this.glassCanvases) {
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
		}

		this._glassCache.clear();
		// Glass content images need re-capture at new size
		this._glassContentDirty = true;
		this._dirty = true;
	}

	// ────────────────────────────────────────────
	// Floating (drag) behaviour — Pointer Events
	// ────────────────────────────────────────────

	_handlePointerDown(e) {
		// Walk sorted children in reverse (topmost first) so we grab
		// the highest glass element under the pointer.
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
				// Normalize to explicit left/top pixel values, clearing
				// any conflicting bottom/right/transform that would
				// cause the element to jump when we start setting left/top.
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

	_handlePointerMove(e) {
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

		const el = this._drag.element;
		const rootRect = this.root.getBoundingClientRect();
		const newLeft = e.clientX - rootRect.left - this._drag.offsetX;
		const newTop = e.clientY - rootRect.top - this._drag.offsetY;

		el.style.left = newLeft + 'px';
		el.style.top = newTop + 'px';

		this._dirty = true;
	}

	_handlePointerUp(_e) {
		if (!this._drag.active) return;
		this._drag.element.style.cursor = '';
		this._drag.active = false;
		this._drag.element = null;
		this._dirty = true;
	}

	// ────────────────────────────────────────────
	// Render loop
	// ────────────────────────────────────────────

	/**
	 * The render loop.  Schedules itself via requestAnimationFrame.
	 * The frame body is synchronous (no await) for maximum performance;
	 * async work (glass content re-capture) is dispatched outside the
	 * frame when needed.
	 */
	_renderLoop() {
		if (!this._running) return;

		// If glass DOM content changed (mutation observer), re-capture
		// it asynchronously.  This is a one-shot operation that runs
		// outside the hot render path.
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

	/**
	 * Render a single frame.  **Fully synchronous** — no await calls.
	 *
	 * Layered compositing algorithm (bottom → top stacking order):
	 *
	 *   Non-glass child  → blit from capture cache (sync drawImage).
	 *                       Dynamic <canvas> elements are re-read each frame.
	 *   Glass child      →
	 *     a. If needed, re-run the WebGL shader pipeline (sync).
	 *     b. Blit the glass shader canvas onto the hidden canvas (sync).
	 *     c. Blit the pre-captured glass DOM content image onto the
	 *        hidden canvas so higher glass elements can see text etc.
	 *        through refraction (sync drawImage).
	 */
	_renderFrame() {
		const dpr = window.devicePixelRatio || 1;
		const rootRect = this.root.getBoundingClientRect();
		const isDragging = this._drag.active;

		const needsRender = this._dirty || this._hasDynamic || isDragging;
		if (!needsRender) return;

		// Clear the hidden 2D canvas for layer-by-layer compositing
		this.capture.clear();

		// bgChanged tracks whether any layer below the *current* child
		// changed since last frame, which invalidates glass caches above.
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

				// ── Decide whether the WebGL shader needs to re-run ──
				const cached = this._glassCache.get(child);
				const posChanged = !cached
					|| Math.abs(cached.centerX - centerX) > 0.5
					|| Math.abs(cached.centerY - centerY) > 0.5;

				const needsShaderRender = isDragging
					? (isBeingDragged || bgChanged)
					: (!cached || posChanged || bgChanged);

				if (needsShaderRender && glassCanvas) {
					// Upload the current hidden canvas as the background
					this.renderer.uploadAndBlur(this.capture.canvas, config.blurAmount);
					this.renderer.clear();
					this.renderer.renderGlassPanel(
						config, centerX, centerY,
						elRect.width, elRect.height, dpr,
					);

					// Copy from offscreen WebGL canvas → glass child canvas
					const ctx = glassCanvas.getContext('2d');
					ctx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
					const srcX = (elRect.left - rootRect.left - SHADOW_PAD) * dpr;
					const srcY = (elRect.top - rootRect.top - SHADOW_PAD) * dpr;
					const srcW = (elRect.width + SHADOW_PAD * 2) * dpr;
					const srcH = (elRect.height + SHADOW_PAD * 2) * dpr;
					ctx.drawImage(
						this.renderer.canvas,
						srcX, srcY, srcW, srcH,
						0, 0, glassCanvas.width, glassCanvas.height,
					);

					this._glassCache.set(child, { centerX, centerY });
					bgChanged = true;
				}

				// ── Composite glass onto hidden canvas for higher layers ──

				// 1) Blit the shader canvas (includes shadow)
				this._blitGlassShader(child, elRect, rootRect, dpr);

				// 2) Overlay the pre-captured DOM content (text etc.)
				//    at the glass element's current position.
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
				// <canvas> elements are drawn synchronously via
				// ctx.drawImage (fast path in captureElement).
				// Other elements use the html-to-image cache.
				// Dynamic non-canvas elements use force=true which
				// triggers an async html-to-image call — but that
				// resolves within this tick for already-cached items.
				const isDynamic = child.hasAttribute('data-dynamic');

				if (child.tagName === 'CANVAS') {
					// Sync fast path: draw the live canvas directly
					const rootR = this.root.getBoundingClientRect();
					const r = child.getBoundingClientRect();
					const x = (r.left - rootR.left) * dpr;
					const y = (r.top - rootR.top) * dpr;
					const w = r.width * dpr;
					const h = r.height * dpr;
					this.capture.ctx.drawImage(child, x, y, w, h);
					if (isDynamic) bgChanged = true;
				} else if (!isDynamic) {
					// Static non-canvas: blit from cache (populated
					// on prior frame's async pass or first render)
					if (!this.capture.blitFromCache(child)) {
						// No cache yet — schedule async capture.
						// It won't be ready THIS frame, but will be
						// available from the next frame onwards.
						this.capture.captureElement(child, false);
					}
				} else {
					// Dynamic non-canvas: must re-capture every frame.
					// This is inherently async / expensive — schedule it.
					this.capture.captureElement(child, true);
					bgChanged = true;
				}
			}
		}

		if (this._dirty) {
			this._dirty = false;
		}
	}

	/**
	 * Blit a glass element's shader canvas onto the hidden 2D canvas.
	 * Fast, synchronous helper used for compositing during layered
	 * rendering and as the drag fast-path.
	 */
	_blitGlassShader(child, elRect, rootRect, dpr) {
		const glassCanvas = this.glassCanvases.get(child);
		if (!glassCanvas) return;
		const compX = (elRect.left - rootRect.left - SHADOW_PAD) * dpr;
		const compY = (elRect.top - rootRect.top - SHADOW_PAD) * dpr;
		const compW = (elRect.width + SHADOW_PAD * 2) * dpr;
		const compH = (elRect.height + SHADOW_PAD * 2) * dpr;
		this.capture.compositeGlass(glassCanvas, compX, compY, compW, compH);
	}
}
