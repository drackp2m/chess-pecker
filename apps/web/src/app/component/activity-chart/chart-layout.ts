import {
	ChartBarGrow,
	ChartBarSettings,
	ChartBarShrink,
	ChartOverflowSettings,
} from '@app/component/activity-chart/chart-config';

const SLOT_EPSILON = 0.02;
const MIN_BAR_WIDTH = 1;

export interface ChartBarLayout {
	readonly count: number;
	readonly columns: number;
	readonly slot: number;
	readonly bar: number;
	readonly content: number;
	readonly viewport: number | null;
}

interface BarSize {
	readonly bar: number;
	readonly slot: number;
}

export const EMPTY_BAR_LAYOUT: ChartBarLayout = {
	count: 0,
	columns: 0,
	slot: 0,
	bar: 0,
	content: 0,
	viewport: null,
};

/**
 * A slot is one bar plus one gap, and only whole slots are painted: the remainder goes back
 * into bar, gap or both so the last bar ends on the edge. `pad` holds `count` slots open.
 */
export function fitBars(
	available: number,
	total: number,
	bars: ChartBarSettings,
	overflow: ChartOverflowSettings,
): ChartBarLayout {
	const wanted = wantedCount(bars, total);

	if (0 >= available || 0 >= wanted) {
		return EMPTY_BAR_LAYOUT;
	}

	const bar = Math.max(0, bars.width);
	const asked = { bar, slot: bar + Math.max(0, bars.gap) };
	const base = shrink(asked, available / wanted, bars.shrink);
	const fitting = 0 >= base.slot ? 0 : Math.floor(available / base.slot + SLOT_EPSILON);

	if (0 === fitting) {
		return EMPTY_BAR_LAYOUT;
	}

	const shown = Math.min(wanted, fitting);
	const size = grow(base, (available - shown * base.slot) / shown, bars.grow);
	const scrolls = 'scroll' === overflow.mode && shown < total;

	return buildLayout(total, shown, size, scrolls, bars.pad);
}

function buildLayout(
	total: number,
	shown: number,
	size: BarSize,
	scrolls: boolean,
	pad: boolean,
): ChartBarLayout {
	const count = scrolls ? total : Math.min(total, shown);
	const padded = pad ? shown : 0;
	const columns = scrolls ? total : Math.max(count, padded);

	return {
		count,
		columns,
		slot: size.slot,
		bar: size.bar,
		content: columns * size.slot,
		viewport: scrolls ? shown * size.slot : null,
	};
}

function wantedCount(bars: ChartBarSettings, total: number): number {
	if ('auto' === bars.count) {
		return total;
	}

	const count = Math.max(0, Math.floor(bars.count));

	return bars.pad ? count : Math.min(total, count);
}

function shrink(size: BarSize, target: number, mode: ChartBarShrink): BarSize {
	if ('none' === mode || size.slot <= target) {
		return size;
	}

	if ('gap' === mode) {
		return { bar: size.bar, slot: Math.max(size.bar, target) };
	}

	if ('bar' === mode) {
		const bar = Math.max(MIN_BAR_WIDTH, target - (size.slot - size.bar));

		return { bar, slot: bar + size.slot - size.bar };
	}

	const bar = Math.max(MIN_BAR_WIDTH, (size.bar * target) / size.slot);

	return { bar, slot: Math.max(bar, target) };
}

function grow(size: BarSize, extra: number, mode: ChartBarGrow): BarSize {
	if (0 >= extra || 'none' === mode) {
		return size;
	}

	if ('bar' === mode) {
		return { bar: size.bar + extra, slot: size.slot + extra };
	}

	if ('gap' === mode) {
		return { bar: size.bar, slot: size.slot + extra };
	}

	return { bar: size.bar + (extra * size.bar) / size.slot, slot: size.slot + extra };
}
