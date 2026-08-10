const NICE_FACTORS = [1, 2, 2.5, 5, 10] as const;

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

export function niceTicks(max: number, count: number): readonly number[] {
	if (0 >= max || 0 >= count) {
		return [0];
	}

	const step = niceStep(max / count);
	const decimals = Math.max(0, -Math.floor(Math.log10(step))) + 1;
	const total = Math.ceil(max / step);

	return Array.from({ length: total + 1 }, (_unused, index) =>
		Number((index * step).toFixed(decimals)),
	);
}

export function niceMax(max: number, count: number): number {
	return niceTicks(max, count).at(-1) ?? max;
}

function niceStep(rough: number): number {
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const normalized = rough / magnitude;

	return (NICE_FACTORS.find((factor) => normalized <= factor) ?? 10) * magnitude;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
