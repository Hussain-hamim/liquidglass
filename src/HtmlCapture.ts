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

interface CacheEntry {
	canvas: HTMLCanvasElement;
	x: number;
	y: number;
	w: number;
	h: number;
}

export class HtmlCapture {
	readonly root: HTMLElement;
	useHtmlApi: boolean;
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	readonly cache: Map<HTMLElement, CacheEntry>;
	dpr: number;

	constructor(root: HTMLElement, useHtmlApi = false) {
		this.root = root;
		this.useHtmlApi = useHtmlApi;

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
	 * Capture a single DOM element onto the hidden canvas at its
	 * correct position relative to the root.
	 */
	async captureElement(element: HTMLElement, force = false): Promise<void> {
		const rootRect = this.root.getBoundingClientRect();
		const rect = element.getBoundingClientRect();
		const cssX = rect.left - rootRect.left;
		const cssY = rect.top - rootRect.top;
		const cssW = rect.width;
		const cssH = rect.height;
		const x = cssX * this.dpr;
		const y = cssY * this.dpr;
		const w = cssW * this.dpr;
		const h = cssH * this.dpr;

		// Use cache for static elements
		if (!force && this.cache.has(element)) {
			const cached = this.cache.get(element)!;
			if (cached.x === x && cached.y === y && cached.w === w && cached.h === h) {
				this.ctx.drawImage(cached.canvas, x, y, w, h);
				return;
			}
			this.cache.delete(element);
		}

		// Check if the element is a <canvas> — draw it directly
		if (element.tagName === 'CANVAS') {
			this.ctx.drawImage(element as HTMLCanvasElement, x, y, w, h);
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
	 */
	async captureToCanvas(
		element: HTMLElement,
		cssW: number,
		cssH: number,
		hideNodes: HTMLElement[] | null = null,
	): Promise<HTMLCanvasElement | null> {
		const savedDisplays: string[] = [];
		if (hideNodes) {
			for (const node of hideNodes) {
				savedDisplays.push(node.style.display);
				node.style.display = 'none';
			}
		}

		try {
			const rendered = await toCanvas(element, {
				width: cssW,
				height: cssH,
				pixelRatio: this.dpr,
				backgroundColor: undefined,
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
			if (hideNodes) {
				for (let i = 0; i < hideNodes.length; i++) {
					hideNodes[i].style.display = savedDisplays[i];
				}
			}
		}
	}

	/**
	 * Remove an element's entry from the capture cache.
	 */
	invalidateCache(element: HTMLElement): void {
		this.cache.delete(element);
	}

	/**
	 * Blit a cached capture onto the hidden canvas without re-capturing.
	 * Returns true if a cache entry existed, false otherwise.
	 */
	blitFromCache(element: HTMLElement): boolean {
		const cached = this.cache.get(element);
		if (cached) {
			this.ctx.drawImage(cached.canvas, cached.x, cached.y, cached.w, cached.h);
			return true;
		}
		return false;
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

	/** Clear the hidden canvas. */
	clear(): void {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	}

	/** Destroy the capture system and free resources. */
	destroy(): void {
		this.cache.clear();
		this.canvas.remove();
	}

	// ────────────────────────────────────────────
	// html-to-image back-end (default)
	// ────────────────────────────────────────────

	private async _captureWithHtmlToImage(
		element: HTMLElement,
		x: number,
		y: number,
		w: number,
		h: number,
		cssW: number,
		cssH: number,
		force: boolean,
	): Promise<void> {
		try {
			const rendered = await toCanvas(element, {
				width: cssW,
				height: cssH,
				pixelRatio: this.dpr,
			});

			this.ctx.drawImage(rendered, x, y, w, h);

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

	private async _captureWithHtmlApi(
		element: HTMLElement,
		x: number,
		y: number,
		w: number,
		h: number,
		cssW: number,
		cssH: number,
		force: boolean,
	): Promise<void> {
		const ctx = this.ctx as CanvasRenderingContext2D & {
			drawHTML?: (el: HTMLElement, x: number, y: number, w: number, h: number) => Promise<void>;
		};

		if (typeof ctx.drawHTML === 'function') {
			this.ctx.save();
			this.ctx.translate(x, y);
			this.ctx.scale(this.dpr, this.dpr);
			try {
				await ctx.drawHTML(element, 0, 0, cssW, cssH);
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
