/**
 * GlassRenderer — WebGL rendering pipeline for the liquid glass effect.
 *
 * Manages a single offscreen WebGL canvas, shader programs, FBOs for
 * blur passes, and exposes methods to upload a background texture,
 * blur it, and render individual glass panels.
 *
 * The offscreen canvas is sized to match the root element so that all
 * glass panels can be rendered at their correct screen positions.
 * After rendering, the relevant region is copied to each glass
 * element's child canvas via drawImage.
 */

import { VS_QUAD, FS_BLIT, FS_BLUR, VS_GLASS, FS_GLASS } from './shaders.js';
import { BLUR_ITERATIONS, SHADOW_PAD } from './defaults.js';
import type { GlassConfig } from './defaults.js';

interface FBO {
	fbo: WebGLFramebuffer;
	tex: WebGLTexture;
	w: number;
	h: number;
}

type UniformMap = Record<string, WebGLUniformLocation | null>;

export class GlassRenderer {
	readonly canvas: HTMLCanvasElement;
	readonly gl: WebGLRenderingContext;

	private blitP!: WebGLProgram;
	private blitU!: UniformMap;
	private blurP!: WebGLProgram;
	private blurU!: UniformMap;
	private glassP!: WebGLProgram;
	private glassU!: UniformMap;

	private quadBuf!: WebGLBuffer;
	private panelBuf!: WebGLBuffer;

	private bgFBO: FBO | null = null;
	private blurA: FBO | null = null;
	private blurB: FBO | null = null;

	private bgTex: WebGLTexture | null = null;

	width = 0;
	height = 0;

	contextLost = false;

	private _onContextLost: (e: Event) => void;
	private _onContextRestored: () => void;

	constructor() {
		this.canvas = document.createElement('canvas');
		this.canvas.style.display = 'none';
		document.body.appendChild(this.canvas);

		const gl = this.canvas.getContext('webgl', {
			alpha: true,
			premultipliedAlpha: false,
			antialias: false,
			preserveDrawingBuffer: true,
		});

		if (!gl) {
			throw new Error('LiquidGlass: WebGL is not supported in this browser.');
		}
		this.gl = gl;

		this._initPrograms();
		this._initBuffers();

		this._onContextLost = (e: Event) => {
			e.preventDefault();
			this.contextLost = true;
			console.warn('LiquidGlass: WebGL context lost.');
		};
		this._onContextRestored = () => {
			console.info('LiquidGlass: WebGL context restored — reinitialising.');
			this.contextLost = false;
			this._initPrograms();
			this._initBuffers();
			this.bgTex = null;
			this._initFBOs(this.width, this.height);
		};
		this.canvas.addEventListener('webglcontextlost', this._onContextLost);
		this.canvas.addEventListener('webglcontextrestored', this._onContextRestored);
	}

	// ────────────────────────────────────────────
	// Initialisation
	// ────────────────────────────────────────────

	private _initPrograms(): void {
		this.blitP = this._link(VS_QUAD, FS_BLIT);
		this.blitU = this._uloc(this.blitP, ['u_tex', 'u_scale', 'u_offset']);

		this.blurP = this._link(VS_QUAD, FS_BLUR);
		this.blurU = this._uloc(this.blurP, ['u_tex', 'u_dir']);

		this.glassP = this._link(VS_GLASS, FS_GLASS);
		this.glassU = this._uloc(this.glassP, [
			'u_bgTex', 'u_blurTex', 'u_center', 'u_size', 'u_radius',
			'u_res', 'u_pad', 'u_frost', 'u_refract', 'u_chroma',
			'u_edgeHL', 'u_spec', 'u_fresnel', 'u_distort', 'u_alpha',
			'u_sat', 'u_tint', 'u_zRadius', 'u_brightness',
			'u_shadowAlpha', 'u_shadowSpread', 'u_shadowOffY',
		]);
	}

	private _initBuffers(): void {
		const gl = this.gl;

		this.quadBuf = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

		this.panelBuf = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.panelBuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, .5, -.5, -.5, .5, .5, .5]), gl.STATIC_DRAW);
	}

	// ────────────────────────────────────────────
	// Resize
	// ────────────────────────────────────────────

	resize(width: number, height: number): void {
		this.width = width;
		this.height = height;
		this.canvas.width = width;
		this.canvas.height = height;
		this._initFBOs(width, height);
	}

	// ────────────────────────────────────────────
	// Background upload
	// ────────────────────────────────────────────

	uploadAndBlur(sourceCanvas: HTMLCanvasElement, blurAmount: number): void {
		if (this.contextLost) return;
		const gl = this.gl;
		const W = this.width;
		const H = this.height;

		if (!this.bgTex) {
			this.bgTex = gl.createTexture();
		}
		gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true as unknown as number);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false as unknown as number);

		// Blit source → bgFBO (full resolution)
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.bgFBO!.fbo);
		gl.viewport(0, 0, W, H);
		gl.useProgram(this.blitP);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
		gl.uniform1i(this.blitU.u_tex, 0);
		gl.uniform2f(this.blitU.u_scale, 1, 1);
		gl.uniform2f(this.blitU.u_offset, 0, 0);
		this._drawQuad(this.blitP, this.quadBuf);

		// Copy bgFBO → blurA
		const bw = this.blurA!.w;
		const bh = this.blurA!.h;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurA!.fbo);
		gl.viewport(0, 0, bw, bh);
		gl.bindTexture(gl.TEXTURE_2D, this.bgFBO!.tex);
		gl.uniform2f(this.blitU.u_scale, 1, 1);
		gl.uniform2f(this.blitU.u_offset, 0, 0);
		this._drawQuad(this.blitP, this.quadBuf);

		// Multi-pass Gaussian blur (skip entirely when not needed)
		if (blurAmount > 0) {
			const spread = blurAmount * 2.5;
			gl.useProgram(this.blurP);
			gl.uniform1i(this.blurU.u_tex, 0);
			for (let i = 0; i < BLUR_ITERATIONS; i++) {
				gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurB!.fbo);
				gl.viewport(0, 0, bw, bh);
				gl.bindTexture(gl.TEXTURE_2D, this.blurA!.tex);
				gl.uniform2f(this.blurU.u_dir, spread / bw, 0);
				this._drawQuad(this.blurP, this.quadBuf);

				gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurA!.fbo);
				gl.bindTexture(gl.TEXTURE_2D, this.blurB!.tex);
				gl.uniform2f(this.blurU.u_dir, 0, spread / bh);
				this._drawQuad(this.blurP, this.quadBuf);
			}
		}
	}

	// ────────────────────────────────────────────
	// Glass panel rendering
	// ────────────────────────────────────────────

	renderGlassPanel(
		config: GlassConfig,
		centerX: number,
		centerY: number,
		width: number,
		height: number,
		dpr: number,
	): void {
		if (this.contextLost) return;
		const gl = this.gl;
		const W = this.width;
		const H = this.height;

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(this.glassP);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.bgFBO!.tex);
		gl.uniform1i(this.glassU.u_bgTex, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.blurA!.tex);
		gl.uniform1i(this.glassU.u_blurTex, 1);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, W, H);
		gl.uniform2f(this.glassU.u_res, W, H);

		gl.uniform2f(this.glassU.u_center, centerX * dpr, centerY * dpr);
		gl.uniform2f(this.glassU.u_size, width * dpr, height * dpr);

		gl.uniform1f(this.glassU.u_radius, config.cornerRadius * dpr);
		gl.uniform1f(this.glassU.u_pad, SHADOW_PAD * dpr);
		gl.uniform1f(this.glassU.u_frost, config.frostAmount);
		gl.uniform1f(this.glassU.u_refract, config.refraction);
		gl.uniform1f(this.glassU.u_chroma, config.chromAberration);
		gl.uniform1f(this.glassU.u_edgeHL, config.edgeHighlight);
		gl.uniform1f(this.glassU.u_spec, config.specular);
		gl.uniform1f(this.glassU.u_fresnel, config.fresnel);
		gl.uniform1f(this.glassU.u_distort, config.distortion);
		gl.uniform1f(this.glassU.u_alpha, config.opacity);
		gl.uniform1f(this.glassU.u_sat, config.saturation);
		gl.uniform1f(this.glassU.u_tint, config.tintStrength);
		gl.uniform1f(this.glassU.u_zRadius, config.zRadius * dpr);
		gl.uniform1f(this.glassU.u_brightness, config.brightness);
		gl.uniform1f(this.glassU.u_shadowAlpha, config.shadowOpacity);
		gl.uniform1f(this.glassU.u_shadowSpread, config.shadowSpread * dpr);
		gl.uniform1f(this.glassU.u_shadowOffY, config.shadowOffsetY * dpr);

		this._drawQuad(this.glassP, this.panelBuf);
		gl.disable(gl.BLEND);
	}

	clear(): void {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.width, this.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	destroy(): void {
		this.canvas.removeEventListener('webglcontextlost', this._onContextLost);
		this.canvas.removeEventListener('webglcontextrestored', this._onContextRestored);
		if (!this.contextLost) {
			const gl = this.gl;
			this._freeFBO(this.bgFBO);
			this._freeFBO(this.blurA);
			this._freeFBO(this.blurB);
			if (this.bgTex) gl.deleteTexture(this.bgTex);
			gl.deleteBuffer(this.quadBuf);
			gl.deleteBuffer(this.panelBuf);
			gl.deleteProgram(this.blitP);
			gl.deleteProgram(this.blurP);
			gl.deleteProgram(this.glassP);
		}
		this.canvas.remove();
	}

	// ────────────────────────────────────────────
	// FBO management
	// ────────────────────────────────────────────

	private _initFBOs(w: number, h: number): void {
		this._freeFBO(this.bgFBO);
		this._freeFBO(this.blurA);
		this._freeFBO(this.blurB);

		this.bgFBO = this._makeFBO(w, h);
		this.blurA = this._makeFBO(w, h);
		this.blurB = this._makeFBO(w, h);
	}

	private _makeFBO(w: number, h: number): FBO {
		const gl = this.gl;
		const tex = gl.createTexture()!;
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		const fbo = gl.createFramebuffer()!;
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		return { fbo, tex, w, h };
	}

	private _freeFBO(fboObj: FBO | null): void {
		if (!fboObj) return;
		const gl = this.gl;
		gl.deleteFramebuffer(fboObj.fbo);
		gl.deleteTexture(fboObj.tex);
	}

	// ────────────────────────────────────────────
	// Shader helpers
	// ────────────────────────────────────────────

	private _compile(src: string, type: number): WebGLShader | null {
		const gl = this.gl;
		const s = gl.createShader(type)!;
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
			console.error('LiquidGlass shader compile error:', gl.getShaderInfoLog(s), src);
			return null;
		}
		return s;
	}

	private _link(vsSrc: string, fsSrc: string): WebGLProgram {
		const gl = this.gl;
		const p = gl.createProgram()!;
		gl.attachShader(p, this._compile(vsSrc, gl.VERTEX_SHADER)!);
		gl.attachShader(p, this._compile(fsSrc, gl.FRAGMENT_SHADER)!);
		gl.linkProgram(p);
		if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
			console.error('LiquidGlass program link error:', gl.getProgramInfoLog(p));
		}
		return p;
	}

	private _uloc(prog: WebGLProgram, names: string[]): UniformMap {
		const gl = this.gl;
		const u: UniformMap = {};
		for (const n of names) {
			u[n] = gl.getUniformLocation(prog, n);
		}
		return u;
	}

	private _drawQuad(prog: WebGLProgram, buf: WebGLBuffer): void {
		const gl = this.gl;
		const loc = gl.getAttribLocation(prog, 'a_pos');
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}
