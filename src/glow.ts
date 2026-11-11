import Cairo from 'cairo';

/** The glow size as a fraction of the screen size. */
export const GLOW_FRACTION = { small: 0.06, medium: 0.1, large: 0.16 } as const;

const WARM_WHITE = [255 / 255, 200 / 255, 140 / 255] as const; // rgb(255, 200, 140)
const PURE_WHITE = [255 / 255, 255 / 255, 255 / 255] as const; // rgb(255, 255, 255)
const COOL_WHITE = [220 / 255, 230 / 255, 255 / 255] as const; // rgb(220, 230, 255)

/**
 * Rendering time is O(n^2) in the long dimension,
 * so render no larger than RENDER_MAX pixels and let the GPU scale it up.
 *
 * For a 1080p screen, this is 1/4 resolution (for 1/16 of the work).
 */
export const RENDER_MAX = 512;
const CURSOR_MASK_RADIUS = 200;

/**
 * Interpolates between warm white (0.0), pure white (0.5), and cool white (1.0).
 *
 * @param t A number between 0 and 1 inclusive.
 * @returns An RGB triple, each component between 0 and 1.
 */
export function glowColor(t: number): [number, number, number] {
	if (t < 0.5) {
		t = t * 2;
		return [
			WARM_WHITE[0] + (PURE_WHITE[0] - WARM_WHITE[0]) * t,
			WARM_WHITE[1] + (PURE_WHITE[1] - WARM_WHITE[1]) * t,
			WARM_WHITE[2] + (PURE_WHITE[2] - WARM_WHITE[2]) * t,
		];
	} else {
		t = (t - 0.5) * 2;
		return [
			PURE_WHITE[0] + (COOL_WHITE[0] - PURE_WHITE[0]) * t,
			PURE_WHITE[1] + (COOL_WHITE[1] - PURE_WHITE[1]) * t,
			PURE_WHITE[2] + (COOL_WHITE[2] - PURE_WHITE[2]) * t,
		];
	}
}

export function glowWidth(width: number, height: number, size: keyof typeof GLOW_FRACTION) {
	return Math.min(width, height) * (GLOW_FRACTION[size] ?? GLOW_FRACTION.medium);
}

/**
 * Draws a glow around the 4 edges of the screen.
 *
 * @param context The Cairo context to paint onto.
 * @param width The width of the area to paint.
 * @param height The height of the area to paint.
 * @param r The red component of the glow color, between 0 and 1.
 * @param g The green component of the glow color, between 0 and 1.
 * @param b The blue component of the glow color, between 0 and 1.
 * @param alpha The alpha (opacity) of the glow, between 0 and 1.
 * @param glowWidth The width/size of the glow band in pixels.
 */
function drawEdges(
	context: Cairo.Context,
	width: number,
	height: number,
	r: number,
	g: number,
	b: number,
	alpha: number,
	glowWidth: number,
) {
	const band = (
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		rect: [number, number, number, number],
	) => {
		const grad = new Cairo.LinearGradient(x0, y0, x1, y1);
		grad.addColorStopRGBA(0.0, r, g, b, alpha);
		grad.addColorStopRGBA(1.0, r, g, b, 0.0);
		context.setSource(grad);
		context.rectangle(...rect);
		context.fill();
	};

	band(0, 0, 0, glowWidth, [0, 0, width, glowWidth]); // top
	band(0, height, 0, height - glowWidth, [0, height - glowWidth, width, glowWidth]); // bottom
	band(0, 0, glowWidth, 0, [0, 0, glowWidth, height]); // left
	band(width, 0, width - glowWidth, 0, [width - glowWidth, 0, glowWidth, height]); // right
}

function drawCursorMask(context: Cairo.Context, x: number, y: number) {
	const gradient = new Cairo.RadialGradient(x, y, 0, x, y, CURSOR_MASK_RADIUS);
	const easeOut = (t: number) => {
		return (1 - t) * (1 - t);
	};
	for (let x = 0; x <= 8; ++x) {
		const t = x / 8;
		const alpha = easeOut(t);
		gradient.addColorStopRGBA(t, 0, 0, 0, alpha);
	}

	context.setOperator(Cairo.Operator.DEST_OUT);
	context.setSource(gradient);
	context.arc(x, y, CURSOR_MASK_RADIUS, 0, 2 * Math.PI);
	context.fill();
	context.setOperator(Cairo.Operator.OVER);
}

/**
 * Paint the glow onto `context`, which is assumed to cover `width` x `height`.
 *
 * @param context The Cairo context to paint onto.
 * @param width The width of the area to paint.
 * @param height The height of the area to paint.
 * @param pointer_x The current mouse X position as a fraction of the screen width, or null if unknown.
 * @param pointer_y The current mouse Y position as a fraction of the screen height, or null if unknown.
 * @param state The state of the glow { brightness, colorTemp, glowSize }.
 */
export function drawGlow(
	context: Cairo.Context,
	width: number,
	height: number,
	pointer_x: number | null,
	pointer_y: number | null,
	state: { brightness: number; colorTemp: number; glowSize: keyof typeof GLOW_FRACTION },
) {
	context.setOperator(Cairo.Operator.SOURCE);
	context.setSourceRGBA(0, 0, 0, 0);
	context.paint();

	const [r, g, b] = glowColor(state.colorTemp);
	const baseGlowWidthPx = glowWidth(width, height, state.glowSize);

	// Overlapping passes: each is wider and dimmer than the last, which stacks
	// into a falloff far softer than one gradient gives.
	const GLOW_PASSES = 5;
	const MIN_ALPHA = 0.5;
	const MAX_ALPHA = 0.85;
	const PASS_WIDEN = 0.25;
	context.setOperator(Cairo.Operator.OVER);
	for (let pass = 0; pass < GLOW_PASSES; pass++) {
		drawEdges(
			context,
			width,
			height,
			r,
			g,
			b,
			state.brightness * (MAX_ALPHA - (MAX_ALPHA - MIN_ALPHA) * (pass / (GLOW_PASSES - 1))),
			baseGlowWidthPx * (1.0 + pass * PASS_WIDEN),
		);
	}

	if (
		pointer_x !== null
		&& pointer_x >= 0
		&& pointer_x <= 1
		&& pointer_y !== null
		&& pointer_y >= 0
		&& pointer_y <= 1
	) {
		drawCursorMask(context, pointer_x * width, pointer_y * height);
	}
}
