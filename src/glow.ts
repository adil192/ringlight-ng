import Cairo from 'cairo';

const GLOW_PASSES = 5;
const MAX_ALPHA = 0.85;
// Each pass is this much wider than the last, as a fraction of the base width.
const PASS_WIDEN = 0.25;

// Fractions of the smaller screen dimension, not pixels: a fixed pixel width
// is a different fraction of the screen on every display it lands on.
export const GLOW_FRACTION = { small: 0.06, medium: 0.1, large: 0.16 } as const;

const WARM_WHITE = [255 / 255, 200 / 255, 140 / 255] as const; // rgb(255, 200, 140)
const PURE_WHITE = [255 / 255, 255 / 255, 255 / 255] as const; // rgb(255, 255, 255)
const COOL_WHITE = [220 / 255, 230 / 255, 255 / 255] as const; // rgb(220, 230, 255)

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

function drawEdges(
	context: Cairo.Context,
	width: number,
	height: number,
	r: number,
	g: number,
	b: number,
	alpha: number,
	w: number,
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

	band(0, 0, 0, w, [0, 0, width, w]); // top
	band(0, height, 0, height - w, [0, height - w, width, w]); // bottom
	band(0, 0, w, 0, [0, 0, w, height]); // left
	band(width, 0, width - w, 0, [width - w, 0, w, height]); // right
}

/**
 * Paint the glow onto `context`, which is assumed to cover `width` x `height`.
 * `state` is {brightness, colorTemp, glowSize}.
 *
 * Nothing here depends on the pointer, or on anything else that changes while
 * the glow is up: this runs once per settings change, never per frame.
 */
export function drawGlow(
	context: Cairo.Context,
	width: number,
	height: number,
	state: { brightness: number; colorTemp: number; glowSize: keyof typeof GLOW_FRACTION },
) {
	context.setOperator(Cairo.Operator.SOURCE);
	context.setSourceRGBA(0, 0, 0, 0);
	context.paint();
	context.setOperator(Cairo.Operator.OVER);

	const [r, g, b] = glowColor(state.colorTemp);
	const base = glowWidth(width, height, state.glowSize);

	// Overlapping passes: each is wider and dimmer than the last, which stacks
	// into a falloff far softer than one gradient gives.
	for (let pass = 0; pass < GLOW_PASSES; pass++) {
		const passFactor = 1.0 - (pass / GLOW_PASSES) * 0.5;
		drawEdges(
			context,
			width,
			height,
			r,
			g,
			b,
			state.brightness * passFactor * MAX_ALPHA,
			base * (1.0 + pass * PASS_WIDEN),
		);
	}
}
