Analyze the demo.html implementation of the liquid glass effect and use it to implement a flexible library that can be used in various web projects.

Turn this into a npm js library called LiquidGlass.
It should be a library that is used like this:
```html
<style>
	body, html {
		margin:0;
		padding:0;
	}
	.inner {
		width:100vw;
		height:100vh;
		bacgkround:url('background.png') no-repeat center center;
		background-size:cover;
	}
	.liquid-glass-1 {
		text-align:center;
		font-size:2em;
		font-weight:bold;
		top:20%;
		left:50%;
	}
	.liquid-glass-2 {
		text-align:center;
		font-size:3em;
		font-weight:bold;
		width:400vw;
		top:50%;
		left:calc(50% - 400vw / 2);
	}
</style>
<div id="liquid-glass-root">
	<div class="liquid-glass liquid-glass-1">Liquid glass content</div>
	<div class="liquid-glass liquid-glass-2">More liquid glass content</div>
	<div class="inner" data-dynamic>
		<h1>Heading</h1>
		<div>More HTML Content</div>
	</div>
</div>
<script>
import { LiquidGlass } from 'liquid-glass';
let liquidGlassElements = document.querySelectorAll('.liquid-glass');
liquidGlassElements[0].dataset.config = {
	blurAmount: 0.25,
	floating: true,
};
liquidGlassElements[1].dataset.config = {
	brightness: -0.5,
	floating: true,
};
LiquidGlass.init({
    root: document.querySelector('#liquid-glass-root'),
	glassElements: liquidGlassElements,
});
</script>
```

Heres how it should work:
- Only handles glassElements that are direct children of the root element.
- It should detect children of the root element.
-- Non-Glass elements:
	---- Non glass elements should be rendered as normal and you must also render them onto a hidden canvas that will be used as the source for the liquid glass effect. This means that any changes to these elements (like animations, hover effects, etc.) should be reflected in the liquid glass effect in real-time. By default assume those elements are static and only render them once so cache them, but if they have the `data-dynamic` attribute, then you should continuously update the hidden canvas to reflect any changes to those elements.
-- Glass elements:
	---- Glass elements should have the liquid glass effect applied to them. This means that they should be rendered with a blurred and distorted version of the content behind them, creating the illusion of looking through a piece of glass.
	---- You must create a "canvas element", put it inside of the glass element and render the liquid glass effect onto that canvas. The canvas should be sized to cover the entire area of the glass element and should be positioned absolutely within it. The liquid glass effect should be created by sampling the hidden canvas (which contains the rendered non-glass elements) and applying shaders to it before rendering it onto the canvas inside the glass element.
	---- You have to consider the position and size of the glass element when sampling from the hidden canvas to ensure that the liquid glass effect is correctly aligned with the content behind it.
	---- You need to add inline styles to the glass elemnt and the canvas child to ensure that they are positioned and sized correctly. The glass element should have `position: relative` and the canvas child should have `position: absolute;inset:0;`to cover the entire area of the glass element.
	---- You also need to take into account z-index and stacking context to ensure that the glass elements are rendered above the non-glass elements and that the liquid glass effect is visible.
	---- Take into account the possibility of multiple glass elements even overlapping each other and ensure that the liquid glass effect is rendered correctly for each of them based on their position and size. You may need to render the glass elements themselves onto the hidden canvas as well to ensure that the effect is correctly applied when they overlap each other. This is a step by step layered process.
	---- Do not assume that non-glass elements will be behind glass elements. There could be some non-glass elements under and some above the glass elements, so you need to consider the entire stacking context when rendering the liquid glass effect.
	---- To render elements onto the hidden canvas, you can implement two methods:
		------ An svg with foreignObject (You WILL need to handle stuff like computing all the styles of all elements within the html and inline them, convert canvases to images with data-uris, load fonts using data-uris...) The whole html needs to be self-contained within the svg foreign object for accurate rendering. This process is performance intensive, which is why caching can be beneficial for static elements. You can also directly write direct canvas child elements (of the root) directly to the hidden canvas to avoid the overhead of using an svg for those elements.
		------ The alternative is to use the new html-in-canvas API, which allows you to directly render HTML elements onto a canvas. This is a more efficient method, but it may not be supported in all browsers yet, so hide this alternative under a flag and use the svg method as a default base implementation.
	---- Make sure to take into consideration the bounding boxes of the child elements so that the rendering on the hidden canvas is accurate and that the liquid glass effect is correctly aligned with the content behind it. You may need to implement a method to compute the bounding boxes.
	---- Glass elements that have the floating option enabled should have an event listeners to allow moving them around the screen. (use Pointer Events)
	---- Whenever you rerender a glass element, you need to reread its configuration options from its dataset and apply those options to the liquid glass effect. This allows for dynamic changes to the configuration of the glass elements, which can be useful for interactive effects or animations.

The library should be built using vanilla JavaScript and should not have any dependencies. It should be designed to be easily integrated into any web project. The library should provide a simple API for configuring the liquid glass effect on individual elements, as well as global settings for the entire root element. The library should also handle resizing and other dynamic changes to the DOM gracefully.
Use Tabs for indentation and make sure to include comments in the code to explain the functionality of each part. Additionally, provide documentation on how to use the library, including examples and a list of available configuration options.

Make no mistakes!