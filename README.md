# LiquidGlass

A liquid glass effect library for the web. Apply realistic glass refraction, blur, chromatic aberration, and lighting effects to any HTML element using WebGL shaders.

## Installation

```bash
npm install liquid-glass
```

Or include directly via `<script type="module">`:

```html
<script type="module">
  import { LiquidGlass } from './src/index.js';
</script>
```

## Quick Start

```html
<div id="root">
  <!-- Non-glass content (rendered normally, captured for glass effect) -->
  <div class="content" data-dynamic>
    <h1>Hello World</h1>
  </div>

  <!-- Glass element (gets the liquid glass effect) -->
  <div class="my-glass">Glass Panel</div>
</div>

<script type="module">
  import { LiquidGlass } from 'liquid-glass';

  const glassEl = document.querySelector('.my-glass');
  glassEl.dataset.config = JSON.stringify({
    floating: true,
    blurAmount: 0.25,
  });

  const instance = LiquidGlass.init({
    root: document.querySelector('#root'),
    glassElements: [glassEl],
  });

  // Later, to tear down:
  // instance.destroy();
</script>
```

## How It Works

1. **Non-glass elements** (direct children of root) render normally in the DOM. They are also captured onto a hidden canvas using SVG `foreignObject` to serve as the background for the glass effect.

2. **Glass elements** receive a child `<canvas>` that displays the liquid glass effect. The effect is rendered with WebGL shaders that sample the captured background, apply blur, refraction, chromatic aberration, specular highlights, and more.

3. **Layered compositing** ensures correct rendering when glass elements overlap each other or when non-glass elements appear above glass in the stacking order.

## API

### `LiquidGlass.init(options)`

Creates and starts a LiquidGlass instance.

| Option | Type | Default | Description |
|---|---|---|---|
| `root` | `HTMLElement` | *(required)* | The container element. All glass and content elements must be direct children. |
| `glassElements` | `NodeList \| HTMLElement[]` | *(required)* | Elements to apply the glass effect to. |
| `defaults` | `object` | `{}` | Override the default configuration values globally. |
| `useHtmlInCanvas` | `boolean` | `false` | Use the experimental html-in-canvas API instead of SVG foreignObject. |

**Returns** a `LiquidGlass` instance with a `.destroy()` method.

### `instance.destroy()`

Stops the render loop, removes injected canvases, cleans up event listeners and WebGL resources.

## Per-Element Configuration

Configure individual glass elements by setting `data-config` to a JSON string:

```javascript
element.dataset.config = JSON.stringify({
  blurAmount: 0.25,
  floating: true,
  cornerRadius: 40,
});
```

The configuration is re-read on every frame, so you can change it dynamically.

### Available Options

| Option | Type | Default | Range | Description |
|---|---|---|---|---|
| `blurAmount` | `number` | `0.00` | 0 – 1 | Background blur intensity |
| `frostAmount` | `number` | `1.00` | 0 – 1 | Frosted glass intensity |
| `refraction` | `number` | `0.69` | 0 – 1 | How much the glass bends the image behind it |
| `chromAberration` | `number` | `0.03` | 0 – 1 | Chromatic aberration (colour fringing at edges) |
| `edgeHighlight` | `number` | `0.21` | 0 – 1 | Edge glow / rim lighting intensity |
| `specular` | `number` | `0.00` | 0 – 1 | Specular highlight intensity (Blinn-Phong) |
| `fresnel` | `number` | `1.00` | 0 – 1 | Fresnel reflection at grazing angles |
| `distortion` | `number` | `0.00` | 0 – 1 | Micro-distortion noise |
| `cornerRadius` | `number` | `65` | 0 – 100 | Corner radius in CSS pixels |
| `zRadius` | `number` | `40` | 1 – 120 | Bevel depth (pill curvature) |
| `opacity` | `number` | `1.00` | 0 – 1 | Overall glass opacity |
| `saturation` | `number` | `0.00` | -1 – 1 | Saturation adjustment |
| `tintStrength` | `number` | `0.00` | 0 – 1 | Cool blue glass tint strength |
| `brightness` | `number` | `0.00` | -0.5 – 0.5 | Brightness adjustment |
| `shadowOpacity` | `number` | `0.30` | 0 – 1 | Drop shadow opacity |
| `shadowSpread` | `number` | `10` | 1 – 80 | Drop shadow spread in pixels |
| `shadowOffsetY` | `number` | `1` | -30 – 50 | Shadow vertical offset in pixels |
| `floating` | `boolean` | `false` | — | Enable drag-to-move via Pointer Events |

## Element Attributes

### `data-dynamic`

Add `data-dynamic` to non-glass children of the root element to mark them as dynamic. Dynamic elements are re-captured every frame, so animations, hover effects, and other live changes are reflected in the glass effect in real-time.

Static elements (without `data-dynamic`) are captured once and cached for performance.

```html
<div id="root">
  <!-- Captured once, cached -->
  <div class="static-bg">...</div>

  <!-- Re-captured every frame -->
  <div class="animated-content" data-dynamic>...</div>

  <div class="glass">...</div>
</div>
```

### `data-config`

JSON string of per-element configuration options (see table above).

## HTML Capture Methods

### html-to-image (default)

The default method uses the [`html-to-image`](https://www.npmjs.com/package/html-to-image) library, which handles cloning nodes, inlining computed styles, embedding fonts as base-64, converting `<canvas>` / `<img>` elements to data-URIs, and rasterising via SVG `foreignObject` under the hood. Static elements are captured once and cached for performance.

### html-in-canvas API (experimental)

When `useHtmlInCanvas: true` is passed to `init()`, the library uses the proposed `CanvasRenderingContext2D.drawHTML()` API. This is more efficient but not yet widely supported. If the API is unavailable, the library automatically falls back to `html-to-image`.

## Stacking & Z-Index

The library respects the visual stacking order of all direct children of the root element. Glass elements do not need to be the topmost children — the library correctly handles:

- Non-glass elements below glass elements
- Non-glass elements above glass elements  
- Overlapping glass elements (layered compositing)

## Browser Support

Requires WebGL 1.0 support. Works in all modern browsers (Chrome, Firefox, Safari, Edge).

## License

MIT
