/**
 * HtmlCapture — renders DOM elements onto a hidden 2D canvas.
 *
 * Uses the `html-to-image` library to rasterise DOM nodes into
 * canvas-ready images.  The library handles style inlining, font
 * embedding, canvas/image conversion and all the SVG-foreignObject
 * plumbing internally.
 *
 * Static elements are captured once and cached.  Elements with the
 * `data-dynamic` attribute are re-captured every frame.
 */
import { toCanvas } from 'html-to-image';

interface CacheEntry {
	canvas: HTMLCanvasElement;
	x: number;
	y: number;
	w: number;
	h: number;
}

export class HtmlCapture {
	readonly root: HTMLElement;
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	readonly cache: Map<HTMLElement, CacheEntry>;
	dpr: number;
	/** Elements with an in-flight html-to-image re-capture (dedupe). */
	private readonly _capturing = new Set<HTMLElement>();
	/** Optional callback fired when an async re-capture finishes and the cache changes. */
	onCacheUpdate: (() => void) | null = null;

	constructor(root: HTMLElement) {
		this.root = root;

		this.canvas = document.createElement('canvas');
		this.canvas.style.display = 'none';
		document.body.appendChild(this.canvas);

		this.ctx = this.canvas.getContext('2d')!;
		this.cache = new Map();
		this.dpr = 1;
	}

	// ────────────────────────────────────────────
	// Public API
	// ────────────────────────────────────────────

	/**
	 * Resize the hidden canvas to match the root element.
	 */
	resize(width: number, height: number, dpr = 1): void {
		this.canvas.width = width;
		this.canvas.height = height;
		this.dpr = dpr;
		// Invalidate all caches on resize since positions / sizes change
		this.cache.clear();
	}

	/**
	 * Draw an element onto the hidden compositing canvas at its current
	 * bounding rect, ensuring the cache is fresh.
	 *
	 * Cache semantics:
	 *   - Fresh hit (size matches within 0.5 px) → blit cached canvas
	 *     at the current x/y. Done.
	 *   - Stale hit (size differs) → blit cached canvas STRETCHED at
	 *     the current x/y (better than a transparent gap), AND kick
	 *     off an async re-capture. The stale entry stays in the cache
	 *     until the new capture is ready to overwrite it; future
	 *     frames keep blitting it stretched in the meantime.
	 *   - Cache miss → kick off an async capture. Nothing is drawn
	 *     this call; the caller should set _dirty so a future frame
	 *     re-runs once the async completes.
	 *
	 * Concurrent re-captures for the same element are deduplicated
	 * via the `_capturing` set, so calling this every frame is cheap.
	 */
	async captureElement(element: HTMLElement, force = false): Promise<void> {
		const rootRect = this.root.getBoundingClientRect();
		const rect = element.getBoundingClientRect();
		const cssW = rect.width;
		const cssH = rect.height;
		const x = (rect.left - rootRect.left) * this.dpr;
		const y = (rect.top - rootRect.top) * this.dpr;
		const w = cssW * this.dpr;
		const h = cssH * this.dpr;

		// Always blit any existing cache first — even if stale — so the
		// compositing canvas never has a transparent hole at this
		// element's location while async work runs in the background.
		let cacheIsFresh = false;
		const cached = this.cache.get(element);
		if (cached) {
			this.ctx.drawImage(cached.canvas, x, y, w, h);
			cached.x = x;
			cached.y = y;
			cacheIsFresh =
				Math.abs(cached.w - w) < 0.5 && Math.abs(cached.h - h) < 0.5;
		}

		if (!force && cacheIsFresh) return;

		// Dedupe concurrent re-captures for the same element. The
		// previous in-flight call will overwrite the cache when done.
		if (this._capturing.has(element)) return;

		// Canvas elements are drawn directly via the fast path.
		if (element.tagName === 'CANVAS') {
			if (!cached) {
				this.ctx.drawImage(element as HTMLCanvasElement, x, y, w, h);
			}
			return;
		}

		this._capturing.add(element);
		try {
			await this._captureWithHtmlToImage(element, x, y, w, h, cssW, cssH);
		} finally {
			this._capturing.delete(element);
		}
	}

	/**
	 * Capture an element's DOM content as a standalone canvas, optionally
	 * excluding specified child nodes from the capture.
	 *
	 * The hideNodes are pruned from the cloned tree via html-to-image's
	 * filter callback, so the live DOM is never mutated and there is no
	 * visible flicker on the page even when this runs inside the render
	 * loop (e.g. on a re-capture triggered by a content change).
	 */
	async captureToCanvas(
		element: HTMLElement,
		cssW: number,
		cssH: number,
		hideNodes: HTMLElement[] | null = null,
	): Promise<HTMLCanvasElement | null> {
		const hideSet: Set<HTMLElement> | null = hideNodes && hideNodes.length
			? new Set(hideNodes)
			: null;

		try {
			const rendered = await toCanvas(element, {
				width: cssW,
				height: cssH,
				pixelRatio: this.dpr,
				backgroundColor: undefined,
				// Prevents SecurityError from cross-origin font stylesheets
				// (e.g. Google Fonts / Material Icons). This capture is used
				// for glass-on-glass compositing only, so font quality here
				// does not affect the primary user-visible display.
				skipFonts: true,
				filter: hideSet
					? (node: HTMLElement) => !hideSet.has(node)
					: undefined,
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
		}
	}

	/**
	 * Remove an element's entry from the capture cache.
	 */
	invalidateCache(element: HTMLElement): void {
		this.cache.delete(element);
	}

	/**
	 * Draw a rendered glass canvas onto the hidden canvas (for layered
	 * compositing — higher glass elements need to see lower ones).
	 */
	compositeGlass(
		glassCanvas: HTMLCanvasElement,
		x: number,
		y: number,
		w: number,
		h: number,
	): void {
		this.ctx.drawImage(glassCanvas, 0, 0, glassCanvas.width, glassCanvas.height, x, y, w, h);
	}

	/** Clear the hidden canvas (filled white — matches a typical page background). */
	clear(): void {
		this.ctx.fillStyle = '#ffffff';
		this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/** Destroy the capture system and free resources. */
	destroy(): void {
		this.cache.clear();
		this.canvas.remove();
	}

	// ────────────────────────────────────────────
	// html-to-image back-end
	// ────────────────────────────────────────────

	private async _captureWithHtmlToImage(
		element: HTMLElement,
		x: number,
		y: number,
		w: number,
		h: number,
		cssW: number,
		cssH: number,
	): Promise<void> {
		try {
			const rendered = await toCanvas(element, {
				width: cssW,
				height: cssH,
				pixelRatio: this.dpr,
				// Skip media elements — they're drawn via the fast path
				// (drawImage) and html-to-image can't render video frames.
				filter: (node: HTMLElement) => {
					const tag = node.tagName;
					return tag !== 'VIDEO' && tag !== 'CANVAS';
				},
				// Pass an empty fontEmbedCSS to bypass html-to-image's
				// CSSOM-walking font-embed step. That step throws (and
				// noisily logs) SecurityError on any cross-origin
				// stylesheet (e.g. Google Fonts loaded via <link>),
				// because it tries to insertRule into another sheet that
				// it can't read. Setting fontEmbedCSS to a string makes
				// it skip the entire path. The captured raster falls
				// back to system fonts for any text that needs a custom
				// face — acceptable for the compositing-canvas use case.
				fontEmbedCSS: '',
			});

			// Store the new render in the cache. Do NOT draw to ctx
			// here — the next call to captureElement on a future render
			// frame will blit the refreshed entry. Drawing here would
			// be wasted work since the canvas is cleared every frame.
			this.cache.set(element, { canvas: rendered, x, y, w, h });
			this.onCacheUpdate?.();
		} catch (err) {
			console.warn('LiquidGlass: html-to-image capture failed for element:', element, err);
		}
	}
}
