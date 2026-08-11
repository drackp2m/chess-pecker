const NICE_FACTORS = [1, 2, 2.5, 5, 10] as const;
const SNAP_EPSILON = 1e-9;

export interface ScaleBounds {
	readonly min: number;
	readonly max: number;
}

export interface NiceScale extends ScaleBounds {
	readonly step: number;
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

export function niceScale(bounds: ScaleBounds, count: number): NiceScale {
	const top = Math.max(0, bounds.max);
	const bottom = Math.min(0, bounds.min);
	const span = top - bottom;

	if (0 >= span || 0 >= count) {
		return { min: 0, max: 0, step: 0 };
	}

	const step = niceStep(span / count);
	const decimals = tickDecimals(step);
	const min = snapUp(-bottom, step, decimals);

	return { min: 0 === min ? 0 : -min, max: snapUp(top, step, decimals), step };
}

export function scaleTicks(scale: NiceScale): readonly number[] {
	if (0 >= scale.step) {
		return [0];
	}

	const decimals = tickDecimals(scale.step);
	const total = Math.round((scale.max - scale.min) / scale.step);

	return Array.from({ length: total + 1 }, (_unused, index) =>
		Number((scale.min + index * scale.step).toFixed(decimals)),
	);
}

function snapUp(value: number, step: number, decimals: number): number {
	return 0 >= value ? 0 : Number((Math.ceil(value / step - SNAP_EPSILON) * step).toFixed(decimals));
}

function tickDecimals(step: number): number {
	return Math.max(0, -Math.floor(Math.log10(step))) + 1;
}

function niceStep(rough: number): number {
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const normalized = rough / magnitude;

	return (NICE_FACTORS.find((factor) => normalized <= factor) ?? 10) * magnitude;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}
