/**
 * HtmlCapture — renders DOM elements onto a hidden 2D canvas.
 *
 * Two rendering back-ends are supported:
 *   1. html-to-image (default) — uses the `html-to-image` library to
 *      rasterise DOM nodes into canvas-ready images.  The library
 *      handles style inlining, font embedding, canvas/image conversion
 *      and all the SVG-foreignObject plumbing internally.
 *   2. html-in-canvas API (experimental, behind a flag) — uses the
 *      browser-native HTMLCanvasElement.drawHTML() proposal.
 *
 * Static elements are captured once and cached.  Elements with the
 * `data-dynamic` attribute are re-captured every frame.
 */
import { toCanvas } from 'html-to-image';

export class HtmlCapture {
	/**
	 * @param {HTMLElement} root        The root container element.
	 * @param {boolean}     useHtmlApi  If true, use the html-in-canvas API.
	 */
	constructor(root, useHtmlApi = false) {
		/** @type {HTMLElement} */
		this.root = root;

		/** Whether to use the experimental html-in-canvas API */
		this.useHtmlApi = useHtmlApi;

		/** Hidden 2D canvas that accumulates the captured content */
		this.canvas = document.createElement('canvas');
		this.canvas.style.display = 'none';
		document.body.appendChild(this.canvas);

		/** @type {CanvasRenderingContext2D} */
		this.ctx = this.canvas.getContext('2d');

		/**
		 * Cache of already-rendered static elements.
		 * Maps an element to a pre-rendered canvas snapshot.
		 * @type {Map<HTMLElement, {canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number}>}
		 */
		this.cache = new Map();

		/** Device pixel ratio (set by resize) */
		this.dpr = 1;
	}

	// ────────────────────────────────────────────
	// Public API
	// ────────────────────────────────────────────

	/**
	 * Resize the hidden canvas to match the root element.
	 *
	 * @param {number} width   Width in physical (device) pixels.
	 * @param {number} height  Height in physical (device) pixels.
	 * @param {number} [dpr=1] Device pixel ratio.
	 */
	resize(width, height, dpr = 1) {
		this.canvas.width = width;
		this.canvas.height = height;
		this.dpr = dpr;
		// Invalidate all caches on resize since positions / sizes change
		this.cache.clear();
	}

	/**
	 * Capture a single DOM element onto the hidden canvas at its
	 * correct position relative to the root.
	 *
	 * @param {HTMLElement} element  The element to capture.
	 * @param {boolean}     force   If true, skip the cache.
	 * @returns {Promise<void>}
	 */
	async captureElement(element, force = false) {
		const rootRect = this.root.getBoundingClientRect();
		const rect = element.getBoundingClientRect();
		// CSS-pixel coordinates relative to root
		const cssX = rect.left - rootRect.left;
		const cssY = rect.top - rootRect.top;
		const cssW = rect.width;
		const cssH = rect.height;
		// Physical-pixel coordinates for the DPR-scaled hidden canvas
		const x = cssX * this.dpr;
		const y = cssY * this.dpr;
		const w = cssW * this.dpr;
		const h = cssH * this.dpr;

		// Use cache for static elements
		if (!force && this.cache.has(element)) {
			const cached = this.cache.get(element);
			// If position / size hasn't changed, blit from cache
			if (cached.x === x && cached.y === y && cached.w === w && cached.h === h) {
				this.ctx.drawImage(cached.canvas, x, y, w, h);
				return;
			}
			// Position changed — re-capture
			this.cache.delete(element);
		}

		// Check if the element is a <canvas> — draw it directly
		if (element.tagName === 'CANVAS') {
			this.ctx.drawImage(element, x, y, w, h);
			return;
		}

		if (this.useHtmlApi) {
			await this._captureWithHtmlApi(element, x, y, w, h, cssW, cssH, force);
		} else {
			await this._captureWithHtmlToImage(element, x, y, w, h, cssW, cssH, force);
		}
	}

	/**
	 * Capture an element's DOM content as a standalone canvas, optionally
	 * hiding specified child nodes during the capture.
	 *
	 * This is designed to run **outside** the render loop (e.g. during
	 * init) so that the brief display:none on hideNodes is not visible
	 * to the user.  The returned canvas can then be blitted synchronously
	 * inside the render loop via drawImage.
	 *
	 * @param {HTMLElement}        element     The element to capture.
	 * @param {number}             cssW        Width in CSS pixels.
	 * @param {number}             cssH        Height in CSS pixels.
	 * @param {HTMLElement[]|null} hideNodes   Children to hide during capture.
	 * @returns {Promise<HTMLCanvasElement|null>}  The captured canvas, or null on error.
	 */
	async captureToCanvas(element, cssW, cssH, hideNodes = null) {
		// Hide specified child nodes before capture
		const savedDisplays = [];
		if (hideNodes) {
			for (const node of hideNodes) {
				savedDisplays.push(node.style.display);
				node.style.display = 'none';
			}
		}

		try {
			// Override position-related styles on the CLONE (not the
			// live element).  html-to-image inlines all computed styles
			// onto the clone — including absolute positioning offsets
			// (top/left/right/bottom) and transforms — which cause the
			// content to render outside the SVG foreignObject's bounds.
			// Resetting them to neutral values keeps content in-frame.
			const rendered = await toCanvas(element, {
				width: cssW,
				height: cssH,
				pixelRatio: this.dpr,
				backgroundColor: null,
				style: {
					position: 'static',
					top: 'auto',
					left: 'auto',
					right: 'auto',
					bottom: 'auto',
					transform: 'none',
					margin: '0',
				},
			});
			return rendered;
		} catch (err) {
			console.warn('LiquidGlass: captureToCanvas failed for element:', element, err);
			return null;
		} finally {
			// Restore hidden nodes
			if (hideNodes) {
				for (let i = 0; i < hideNodes.length; i++) {
					hideNodes[i].style.display = savedDisplays[i];
				}
			}
		}
	}

	/**
	 * Remove an element's entry from the capture cache.
	 *
	 * @param {HTMLElement} element
	 */
	invalidateCache(element) {
		this.cache.delete(element);
	}

	/**
	 * Blit a cached capture onto the hidden canvas without re-capturing.
	 * Returns true if a cache entry existed, false otherwise.
	 *
	 * @param {HTMLElement} element
	 * @returns {boolean}
	 */
	blitFromCache(element) {
		if (this.cache.has(element)) {
			const cached = this.cache.get(element);
			this.ctx.drawImage(cached.canvas, cached.x, cached.y, cached.w, cached.h);
			return true;
		}
		return false;
	}

	/**
	 * Draw a rendered glass canvas onto the hidden canvas (for layered
	 * compositing — higher glass elements need to see lower ones).
	 *
	 * @param {HTMLCanvasElement} glassCanvas  The glass element's child canvas.
	 * @param {number} x      X position in physical pixels.
	 * @param {number} y      Y position in physical pixels.
	 * @param {number} w      Width in physical pixels.
	 * @param {number} h      Height in physical pixels.
	 */
	compositeGlass(glassCanvas, x, y, w, h) {
		this.ctx.drawImage(glassCanvas, 0, 0, glassCanvas.width, glassCanvas.height, x, y, w, h);
	}

	/**
	 * Clear the hidden canvas.
	 */
	clear() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/**
	 * Destroy the capture system and free resources.
	 */
	destroy() {
		this.cache.clear();
		this.canvas.remove();
	}

	// ────────────────────────────────────────────
	// html-to-image back-end (default)
	// ────────────────────────────────────────────

	/**
	 * Capture an element using the `html-to-image` library.
	 *
	 * @param {HTMLElement}  element  The DOM element to capture.
	 * @param {number}       x       Destination X in physical pixels.
	 * @param {number}       y       Destination Y in physical pixels.
	 * @param {number}       w       Destination width in physical pixels.
	 * @param {number}       h       Destination height in physical pixels.
	 * @param {number}       cssW    Element width in CSS pixels.
	 * @param {number}       cssH    Element height in CSS pixels.
	 * @param {boolean}      force   Skip cache.
	 */
	async _captureWithHtmlToImage(element, x, y, w, h, cssW, cssH, force) {
		try {
			const rendered = await toCanvas(element, {
				width: cssW,
				height: cssH,
				pixelRatio: this.dpr,
			});

			// Draw the rendered canvas onto the hidden accumulation canvas
			this.ctx.drawImage(rendered, x, y, w, h);

			// Cache for static elements
			if (!force) {
				this.cache.set(element, { canvas: rendered, x, y, w, h });
			}
		} catch (err) {
			console.warn('LiquidGlass: html-to-image capture failed for element:', element, err);
		}
	}

	// ────────────────────────────────────────────
	// html-in-canvas API back-end (experimental)
	// ────────────────────────────────────────────

	/**
	 * Capture an element using the proposed html-in-canvas API.
	 * Falls back to html-to-image if the API is unavailable.
	 *
	 * @param {HTMLElement} element  The DOM element to capture.
	 * @param {number} x      Destination X in physical pixels.
	 * @param {number} y      Destination Y in physical pixels.
	 * @param {number} w      Destination width in physical pixels.
	 * @param {number} h      Destination height in physical pixels.
	 * @param {number} cssW   Element width in CSS pixels.
	 * @param {number} cssH   Element height in CSS pixels.
	 * @param {boolean} force Skip cache.
	 * @see https://github.com/nickochar/html-in-canvas-proposal
	 */
	async _captureWithHtmlApi(element, x, y, w, h, cssW, cssH, force) {
		if (typeof this.ctx.drawHTML === 'function') {
			this.ctx.save();
			this.ctx.translate(x, y);
			this.ctx.scale(this.dpr, this.dpr);
			try {
				await this.ctx.drawHTML(element, 0, 0, cssW, cssH);
			} catch (_err) {
				this.ctx.restore();
				await this._captureWithHtmlToImage(element, x, y, w, h, cssW, cssH, force);
				return;
			}
			this.ctx.restore();
		} else {
			console.warn('LiquidGlass: html-in-canvas API not available, falling back to html-to-image.');
			this.useHtmlApi = false;
			await this._captureWithHtmlToImage(element, x, y, w, h, cssW, cssH, force);
		}
	}
}
