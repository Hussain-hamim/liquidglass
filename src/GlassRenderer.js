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

export class GlassRenderer {
	constructor() {
		/** Offscreen WebGL canvas (not added to DOM) */
		this.canvas = document.createElement('canvas');
		this.canvas.style.display = 'none';
		// Append to body so drawImage can read from it
		document.body.appendChild(this.canvas);

		/** @type {WebGLRenderingContext} */
		this.gl = this.canvas.getContext('webgl', {
			alpha: true,
			premultipliedAlpha: false,
			antialias: false,
			preserveDrawingBuffer: true,
		});

		if (!this.gl) {
			throw new Error('LiquidGlass: WebGL is not supported in this browser.');
		}

		// Compile shader programs
		this._initPrograms();
		// Create geometry buffers
		this._initBuffers();

		// FBOs (created on resize)
		/** @type {{fbo: WebGLFramebuffer, tex: WebGLTexture, w: number, h: number}|null} */
		this.bgFBO = null;
		this.blurA = null;
		this.blurB = null;

		/** Uploaded background texture */
		this.bgTex = null;

		/** Current canvas dimensions */
		this.width = 0;
		this.height = 0;
	}

	// ────────────────────────────────────────────
	// Initialisation
	// ────────────────────────────────────────────

	/**
	 * Compile and link all shader programs, and cache uniform locations.
	 */
	_initPrograms() {
		const gl = this.gl;

		// Blit program (background copy / downsample)
		this.blitP = this._link(VS_QUAD, FS_BLIT);
		this.blitU = this._uloc(this.blitP, ['u_tex', 'u_scale', 'u_offset']);

		// Blur program (9-tap Gaussian, single direction)
		this.blurP = this._link(VS_QUAD, FS_BLUR);
		this.blurU = this._uloc(this.blurP, ['u_tex', 'u_dir']);

		// Glass program (core liquid-glass composite)
		this.glassP = this._link(VS_GLASS, FS_GLASS);
		this.glassU = this._uloc(this.glassP, [
			'u_bgTex', 'u_blurTex', 'u_center', 'u_size', 'u_radius',
			'u_res', 'u_pad', 'u_frost', 'u_refract', 'u_chroma',
			'u_edgeHL', 'u_spec', 'u_fresnel', 'u_distort', 'u_alpha',
			'u_sat', 'u_tint', 'u_zRadius', 'u_brightness',
			'u_shadowAlpha', 'u_shadowSpread', 'u_shadowOffY',
		]);
	}

	/**
	 * Create vertex buffers for the full-screen quad and the panel quad.
	 */
	_initBuffers() {
		const gl = this.gl;

		// Full-screen quad (-1 to +1)
		this.quadBuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

		// Panel quad (-0.5 to +0.5, scaled by size in vertex shader)
		this.panelBuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, this.panelBuf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-.5, -.5, .5, -.5, -.5, .5, .5, .5]), gl.STATIC_DRAW);
	}

	// ────────────────────────────────────────────
	// Resize
	// ────────────────────────────────────────────

	/**
	 * Resize the offscreen canvas and recreate FBOs.
	 *
	 * @param {number} width   Width in device pixels.
	 * @param {number} height  Height in device pixels.
	 */
	resize(width, height) {
		this.width = width;
		this.height = height;
		this.canvas.width = width;
		this.canvas.height = height;
		this._initFBOs(width, height);
	}

	// ────────────────────────────────────────────
	// Background upload
	// ────────────────────────────────────────────

	/**
	 * Upload a 2D canvas (the captured HTML content) as the background
	 * texture, then blit it into the bgFBO and prepare the blur chain.
	 *
	 * @param {HTMLCanvasElement} sourceCanvas  The hidden 2D capture canvas.
	 * @param {number}           blurAmount    Blur strength (0–1).
	 */
	uploadAndBlur(sourceCanvas, blurAmount) {
		const gl = this.gl;
		const W = this.width;
		const H = this.height;

		// Upload source canvas as a texture
		if (!this.bgTex) {
			this.bgTex = gl.createTexture();
		}
		gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

		// Blit source → bgFBO (identity transform)
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.bgFBO.fbo);
		gl.viewport(0, 0, W, H);
		gl.useProgram(this.blitP);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
		gl.uniform1i(this.blitU.u_tex, 0);
		gl.uniform2f(this.blitU.u_scale, 1, 1);
		gl.uniform2f(this.blitU.u_offset, 0, 0);
		this._drawQuad(this.blitP, this.quadBuf);

		// Downsample bgFBO → blurA
		const hw = this.blurA.w;
		const hh = this.blurA.h;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurA.fbo);
		gl.viewport(0, 0, hw, hh);
		gl.bindTexture(gl.TEXTURE_2D, this.bgFBO.tex);
		gl.uniform2f(this.blitU.u_scale, 1, 1);
		gl.uniform2f(this.blitU.u_offset, 0, 0);
		this._drawQuad(this.blitP, this.quadBuf);

		// Multi-pass Gaussian blur
		const spread = blurAmount * 2.5;
		gl.useProgram(this.blurP);
		gl.uniform1i(this.blurU.u_tex, 0);
		for (let i = 0; i < BLUR_ITERATIONS; i++) {
			// Horizontal blur: blurA → blurB
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurB.fbo);
			gl.viewport(0, 0, hw, hh);
			gl.bindTexture(gl.TEXTURE_2D, this.blurA.tex);
			gl.uniform2f(this.blurU.u_dir, spread / hw, 0);
			this._drawQuad(this.blurP, this.quadBuf);

			// Vertical blur: blurB → blurA
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.blurA.fbo);
			gl.bindTexture(gl.TEXTURE_2D, this.blurB.tex);
			gl.uniform2f(this.blurU.u_dir, 0, spread / hh);
			this._drawQuad(this.blurP, this.quadBuf);
		}
	}

	// ────────────────────────────────────────────
	// Glass panel rendering
	// ────────────────────────────────────────────

	/**
	 * Render a single glass panel onto the offscreen WebGL canvas.
	 * The caller should then copy the relevant region to the glass
	 * element's child canvas via drawImage.
	 *
	 * @param {object} config   Per-panel configuration (merged defaults + overrides).
	 * @param {number} centerX  Panel centre X in root-pixel coords.
	 * @param {number} centerY  Panel centre Y in root-pixel coords.
	 * @param {number} width    Panel width in px.
	 * @param {number} height   Panel height in px.
	 * @param {number} dpr      Device pixel ratio.
	 */
	renderGlassPanel(config, centerX, centerY, width, height, dpr) {
		const gl = this.gl;
		const W = this.width;
		const H = this.height;

		gl.enable(gl.BLEND);
		gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
		gl.useProgram(this.glassP);

		// Bind background and blur textures
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.bgFBO.tex);
		gl.uniform1i(this.glassU.u_bgTex, 0);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.blurA.tex);
		gl.uniform1i(this.glassU.u_blurTex, 1);

		// Viewport & resolution
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, W, H);
		gl.uniform2f(this.glassU.u_res, W, H);

		// Panel geometry
		gl.uniform2f(this.glassU.u_center, centerX * dpr, centerY * dpr);
		gl.uniform2f(this.glassU.u_size, width * dpr, height * dpr);

		// Effect uniforms
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

	/**
	 * Clear the offscreen WebGL canvas.
	 */
	clear() {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.width, this.height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
	}

	/**
	 * Destroy WebGL resources.
	 */
	destroy() {
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
		this.canvas.remove();
	}

	// ────────────────────────────────────────────
	// FBO management
	// ────────────────────────────────────────────

	/**
	 * (Re-)create the framebuffer objects used for the rendering pipeline.
	 * bgFBO is full resolution; blur FBOs are half resolution.
	 */
	_initFBOs(w, h) {
		this._freeFBO(this.bgFBO);
		this._freeFBO(this.blurA);
		this._freeFBO(this.blurB);

		const hw = Math.floor(w / 2);
		const hh = Math.floor(h / 2);
		this.bgFBO = this._makeFBO(w, h);
		this.blurA = this._makeFBO(hw, hh);
		this.blurB = this._makeFBO(hw, hh);
	}

	/**
	 * Create a framebuffer object with an RGBA colour attachment.
	 *
	 * @param {number} w  Width in pixels.
	 * @param {number} h  Height in pixels.
	 * @returns {{fbo: WebGLFramebuffer, tex: WebGLTexture, w: number, h: number}}
	 */
	_makeFBO(w, h) {
		const gl = this.gl;
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		const fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);

		return { fbo, tex, w, h };
	}

	/**
	 * Free a framebuffer object and its texture.
	 */
	_freeFBO(fboObj) {
		if (!fboObj) return;
		const gl = this.gl;
		gl.deleteFramebuffer(fboObj.fbo);
		gl.deleteTexture(fboObj.tex);
	}

	// ────────────────────────────────────────────
	// Shader helpers
	// ────────────────────────────────────────────

	/**
	 * Compile a single shader.
	 *
	 * @param {string} src   GLSL source.
	 * @param {number} type  gl.VERTEX_SHADER or gl.FRAGMENT_SHADER.
	 * @returns {WebGLShader}
	 */
	_compile(src, type) {
		const gl = this.gl;
		const s = gl.createShader(type);
		gl.shaderSource(s, src);
		gl.compileShader(s);
		if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
			console.error('LiquidGlass shader compile error:', gl.getShaderInfoLog(s), src);
			return null;
		}
		return s;
	}

	/**
	 * Link a vertex + fragment shader into a program.
	 *
	 * @param {string} vsSrc  Vertex shader GLSL.
	 * @param {string} fsSrc  Fragment shader GLSL.
	 * @returns {WebGLProgram}
	 */
	_link(vsSrc, fsSrc) {
		const gl = this.gl;
		const p = gl.createProgram();
		gl.attachShader(p, this._compile(vsSrc, gl.VERTEX_SHADER));
		gl.attachShader(p, this._compile(fsSrc, gl.FRAGMENT_SHADER));
		gl.linkProgram(p);
		if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
			console.error('LiquidGlass program link error:', gl.getProgramInfoLog(p));
			return null;
		}
		return p;
	}

	/**
	 * Look up uniform locations by name.
	 *
	 * @param {WebGLProgram} prog   The shader program.
	 * @param {string[]}     names  Uniform names.
	 * @returns {Object<string, WebGLUniformLocation>}
	 */
	_uloc(prog, names) {
		const gl = this.gl;
		const u = {};
		for (const n of names) {
			u[n] = gl.getUniformLocation(prog, n);
		}
		return u;
	}

	/**
	 * Bind a vertex buffer to a_pos and draw a triangle strip quad.
	 *
	 * @param {WebGLProgram} prog  The current shader program.
	 * @param {WebGLBuffer}  buf   The vertex buffer to bind.
	 */
	_drawQuad(prog, buf) {
		const gl = this.gl;
		const loc = gl.getAttribLocation(prog, 'a_pos');
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
	}
}
