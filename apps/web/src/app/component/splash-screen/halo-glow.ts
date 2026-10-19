import type { Point } from '@app/component/splash-screen/geometry';

export interface GlowLayer {
	readonly size: number;
	readonly alpha: number;
}

export function glowLayersOf(value: string): GlowLayer[] {
	return value.split(',').flatMap((layer) => {
		const [size, alpha] = layer.trim().split(/\s+/).map(Number.parseFloat);

		if (undefined === size || undefined === alpha || !Number.isFinite(size + alpha)) {
			return [];
		}

		return 0 < alpha ? [{ size: Math.max(0, size), alpha }] : [];
	});
}

export function drawGlow(
	context: CanvasRenderingContext2D,
	ring: readonly Point[],
	unit: number,
	layers: readonly GlowLayer[],
): void {
	const shift = 2 * context.canvas.width;

	context.save();
	context.globalCompositeOperation = 'lighter';
	context.shadowColor = 'rgb(255 255 255)';
	context.shadowOffsetX = shift;
	context.beginPath();

	for (const point of ring) {
		context.lineTo(point.x - shift, point.y);
	}

	for (const layer of layers) {
		const passes = Math.ceil(layer.alpha);

		context.globalAlpha = layer.alpha / passes;
		context.shadowBlur = layer.size * unit;

		for (let pass = 0; pass < passes; pass++) {
			context.fill();
		}
	}

	context.restore();
}
