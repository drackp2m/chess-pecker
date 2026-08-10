const SLOT_EPSILON = 0.02;

export type SlotFitMode = 'fixed' | 'stretch';

export interface SlotFit {
	readonly count: number;
	readonly size: number;
}

export function fitSlots(
	available: number,
	minSize: number,
	total: number,
	mode: SlotFitMode,
): SlotFit {
	if (0 >= available || 0 >= minSize || 0 >= total) {
		return { count: 0, size: 0 };
	}

	const fitting = Math.max(1, Math.floor(available / minSize + SLOT_EPSILON));
	const count = Math.min(fitting, total);

	return {
		count,
		size: 'stretch' === mode ? Math.max(minSize, available / count) : minSize,
	};
}
