export interface ScaleBounds {
	readonly min: number;
	readonly max: number;
}

export function positiveBounds(values: Iterable<number>): ScaleBounds {
	const positive = [...values].filter((value) => 0 < value);

	return 0 === positive.length
		? { min: 0, max: 0 }
		: { min: Math.min(...positive), max: Math.max(...positive) };
}

export function toBucket(value: number, bounds: ScaleBounds, buckets: number): number {
	if (0 >= value || 0 >= buckets) {
		return 0;
	}

	if (bounds.max === bounds.min) {
		return buckets;
	}

	const ratio = (value - bounds.min) / (bounds.max - bounds.min);

	return 1 + Math.round(clamp(ratio, 0, 1) * (buckets - 1));
}

export function linearScale(value: number, bounds: ScaleBounds, size: number): number {
	if (bounds.max === bounds.min) {
		return size;
	}

	const ratio = (value - bounds.min) / (bounds.max - bounds.min);

	return clamp(ratio, 0, 1) * size;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
