import { describe, expect, it } from 'vitest';

import {
	ChartConfig,
	ChartConfigResolved,
	resolveChartConfig,
} from '@app/component/activity-chart/chart-config';
import { ChartData, ChartLineStyle, ChartSeries } from '@app/component/activity-chart/chart-data';
import { ChartGeometry, buildChartGeometry } from '@app/component/activity-chart/chart-geometry';

interface Row {
	readonly key: string;
	readonly stack: readonly number[];
	readonly lines: readonly number[];
}

interface Options extends ChartConfig {
	readonly width?: number;
	readonly styles?: readonly ChartLineStyle[];
}

function point(key: string, stack: readonly number[], lines: readonly number[] = []): Row {
	return { key, stack, lines };
}

function barSeries(rows: readonly Row[]): readonly ChartSeries[] {
	const count = Math.max(0, ...rows.map((row) => row.stack.length));

	return Array.from({ length: count }, (_unused, index) => ({
		id: `bar-${index.toString()}`,
		label: `bar-${index.toString()}`,
		values: rows.map((row) => row.stack[index] ?? 0),
	}));
}

function lineSeries(
	rows: readonly Row[],
	styles: readonly ChartLineStyle[],
): readonly ChartSeries[] {
	const count = Math.max(0, ...rows.map((row) => row.lines.length));

	return Array.from({ length: count }, (_unused, index) => {
		const style = styles[index];

		return {
			id: `line-${index.toString()}`,
			label: `line-${index.toString()}`,
			type: 'line' as const,
			values: rows.map((row) => row.lines[index] ?? 0),
			...(undefined === style ? {} : { line: style }),
		};
	});
}

function toData(rows: readonly Row[], styles: readonly ChartLineStyle[]): ChartData {
	return {
		points: rows.map((row) => ({ key: row.key, label: row.key, description: row.key })),
		series: [...barSeries(rows), ...lineSeries(rows, styles)],
	};
}

function config(overrides: Options): ChartConfigResolved {
	return resolveChartConfig({
		layout: { height: 100, ...overrides.layout },
		bars: { width: 10, gap: 0, ...overrides.bars },
		axes: { mode: 'none', shared: false, ...overrides.axes },
		guides: { ...overrides.guides },
		labels: { ...overrides.labels },
		legend: { ...overrides.legend },
		interaction: { ...overrides.interaction },
		overflow: { ...overrides.overflow },
	});
}

function build(rows: readonly Row[], overrides: Options = {}): ChartGeometry {
	return buildChartGeometry(
		toData(rows, overrides.styles ?? []),
		config(overrides),
		overrides.width ?? 300,
	);
}

describe('buildChartGeometry', () => {
	it('keeps the points the series starts with and drops the ones that no longer fit', () => {
		const points = Array.from({ length: 50 }, (_unused, index) =>
			point(`day-${index.toString()}`, [1]),
		);

		const geometry = build(points);

		expect(geometry.points).toHaveLength(30);
		expect(geometry.points[0]?.key).toBe('day-0');
		expect(geometry.points.at(-1)?.key).toBe('day-29');
		expect(geometry.dropped).toBe(20);
	});

	it('lands every slot edge on a whole pixel so touching bars share it', () => {
		const points = Array.from({ length: 3 }, (_unused, index) => point(index.toString(), [1]));
		const geometry = build(points, { width: 100, bars: { width: 10, gap: 0 } });

		expect(geometry.slots.map((slot) => slot.x)).toEqual([0, 33, 67]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([0, 33, 67]);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([33, 34, 33]);
	});

	it('shares the whole width between the slots it did keep', () => {
		const geometry = build([point('a', [1]), point('b', [1])]);

		expect(geometry.slots.map((slot) => slot.x)).toEqual([0, 150]);
		expect(geometry.slots.map((slot) => slot.center)).toEqual([75, 225]);
	});

	it('stacks the segments upwards from the baseline', () => {
		const geometry = build([point('a', [1, 3])], { width: 10 });
		const [first, second] = geometry.bars[0]?.segments ?? [];

		expect(geometry.barScale.max).toBe(4);
		expect(first).toEqual({ index: 0, y: 75, height: 25 });
		expect(second).toEqual({ index: 1, y: 0, height: 75 });
	});

	it('stacks on whole pixels, so one segment starts where the one below ends', () => {
		const geometry = build([point('a', [1, 1, 1])], { width: 10 });

		expect(geometry.bars[0]?.segments).toEqual([
			{ index: 0, y: 67, height: 33 },
			{ index: 1, y: 33, height: 34 },
			{ index: 2, y: 0, height: 33 },
		]);
	});

	it('leaves out the segments with nothing to show', () => {
		const geometry = build([point('a', [0, 2, 0])], { width: 10 });

		expect(geometry.bars[0]?.segments.map((segment) => segment.index)).toEqual([1]);
	});

	it('draws one line per series, centred on each slot and scaled on its own maximum', () => {
		const geometry = build([point('a', [1], [2, 0]), point('b', [1], [4, 1])], { width: 20 });

		expect(geometry.lineScale.max).toBe(4);
		expect(geometry.lines[0]?.path).toBe('M 5.00 50.00 L 15.00 0.00');
		expect(geometry.lines[1]?.path).toBe('M 5.00 100.00 L 15.00 75.00');
	});

	it('takes the width and the dash of each line from its own series', () => {
		const geometry = build([point('a', [1], [2, 0]), point('b', [1], [4, 1])], {
			width: 20,
			styles: [{ curve: 'linear', width: 3, dash: '3 3' }],
		});

		expect(geometry.lines[0]).toMatchObject({ width: 3, dash: '3 3' });
		expect(geometry.lines[1]).toMatchObject({ width: 1.5, dash: null });
	});

	it('rounds a smooth line through every vertex', () => {
		const points = [point('a', [1], [0]), point('b', [1], [2]), point('c', [1], [1])];
		const geometry = build(points, {
			width: 30,
			styles: [{ curve: 'smooth', width: 1.5, dash: null }],
		});

		expect(geometry.lines[0]?.path).toBe(
			'M 5.00 100.00 C 6.67 83.33 11.67 8.33 15.00 0.00 C 18.33 -8.33 23.33 41.67 25.00 50.00',
		);
	});

	it('keeps a smooth line flat between two equal values instead of dipping under them', () => {
		const values = [2, 0, 0, 1];
		const points = values.map((value, index) => point(index.toString(), [1], [value]));
		const geometry = build(points, {
			width: 40,
			styles: [{ curve: 'smooth', width: 1.5, dash: null }],
		});

		expect(geometry.lines[0]?.path).toContain('C 18.33 100.00 21.67 100.00 25.00 100.00');
	});

	it('thins the labels out as the slots get narrower', () => {
		const points = Array.from({ length: 30 }, (_unused, index) => point(index.toString(), [1]));

		expect(build(points, { width: 900 }).labelStep).toBe(1);
		expect(build(points, { width: 300 }).labelStep).toBe(3);
	});

	it('honours a label step that was stated outright', () => {
		const points = Array.from({ length: 30 }, (_unused, index) => point(index.toString(), [1]));

		expect(build(points, { width: 900, labels: { step: 5 } }).labelStep).toBe(5);
	});

	it('draws nothing at all before the container has been measured', () => {
		const geometry = build([point('a', [1])], { width: 0 });

		expect(geometry.points).toHaveLength(0);
		expect(geometry.bars).toHaveLength(0);
		expect(geometry.lines).toHaveLength(0);
		expect(geometry.issue).toBeNull();
	});

	it('flattens the bars when there is nothing but zeros', () => {
		const geometry = build([point('a', [0, 0])], { width: 10 });

		expect(geometry.barScale.max).toBe(0);
		expect(geometry.bars[0]?.segments).toEqual([]);
	});
});

describe('negative values', () => {
	const narrow: Options = { width: 20, guides: { baseline: false } };

	it('splits the height between both sides of the zero', () => {
		const geometry = build([point('a', [2]), point('b', [-2])], narrow);

		expect(geometry.barScale).toMatchObject({ min: -2, max: 2 });
		expect(geometry.zeroY).toBe(50);
	});

	it('hangs what is under the zero below the line instead of flattening it', () => {
		const geometry = build([point('a', [2]), point('b', [-2])], narrow);

		expect(geometry.bars[0]?.segments).toEqual([{ index: 0, y: 0, height: 50 }]);
		expect(geometry.bars[1]?.segments).toEqual([{ index: 0, y: 50, height: 50 }]);
	});

	it('stacks each sign on its own side of the zero', () => {
		const geometry = build([point('a', [3, -1])], { ...narrow, width: 10 });

		expect(geometry.bars[0]?.segments).toEqual([
			{ index: 0, y: 0, height: 75 },
			{ index: 1, y: 75, height: 25 },
		]);
	});

	it('keeps the bars clear of the band the baseline stroke covers', () => {
		const geometry = build([point('a', [2]), point('b', [-2])], {
			width: 20,
			guides: { baseline: { width: 5 } },
		});

		expect(geometry.bars[0]?.segments).toEqual([{ index: 0, y: 0, height: 47 }]);
		expect(geometry.bars[1]?.segments).toEqual([{ index: 0, y: 53, height: 47 }]);
	});

	it('insets only the segment sitting on the zero, not the ones stacked over it', () => {
		const geometry = build([point('a', [2, 2, -4])], {
			width: 10,
			guides: { baseline: { width: 4 } },
		});

		expect(geometry.bars[0]?.segments).toEqual([
			{ index: 0, y: 25, height: 23 },
			{ index: 1, y: 0, height: 25 },
			{ index: 2, y: 52, height: 48 },
		]);
	});

	it('leaves the bars alone when nothing dips under the zero', () => {
		const geometry = build([point('a', [2])], {
			width: 10,
			guides: { baseline: { width: 5 } },
		});

		expect(geometry.bars[0]?.segments).toEqual([{ index: 0, y: 0, height: 100 }]);
	});

	it('drops a line under the zero as far as its own domain reaches', () => {
		const geometry = build([point('a', [0], [2]), point('b', [0], [-2])], narrow);

		expect(geometry.lineScale).toMatchObject({ min: -2, max: 2 });
		expect(geometry.lines[0]?.path).toBe('M 5.00 0.00 L 15.00 100.00');
	});
});

describe('direction', () => {
	const two = [point('a', [1]), point('b', [1])];

	it('starts on the left and walks right by default', () => {
		const geometry = build(two);

		expect(geometry.slots.map((slot) => slot.x)).toEqual([0, 150]);
	});

	it('starts on the right and walks left when the series is read backwards', () => {
		const geometry = build(two, { layout: { direction: 'rtl' } });

		expect(geometry.slots.map((slot) => slot.x)).toEqual([150, 0]);
		expect(geometry.slots.map((slot) => slot.center)).toEqual([225, 75]);
	});

	it('drops from the far end whichever way it is read', () => {
		const points = Array.from({ length: 50 }, (_unused, index) =>
			point(`day-${index.toString()}`, [1]),
		);

		const geometry = build(points, { layout: { direction: 'rtl' } });

		expect(geometry.points.at(-1)?.key).toBe('day-29');
		expect(geometry.slots.at(-1)?.x).toBe(0);
	});
});

describe('bar sizing', () => {
	const two = [point('a', [1]), point('b', [1])];
	const sized: Options = { width: 120, bars: { width: 20, gap: 10 } };

	it('keeps bar and gap at the size they were given when neither may grow', () => {
		const geometry = build(two, { ...sized, bars: { width: 20, gap: 10, grow: 'none' } });

		expect(geometry.width).toBe(60);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([20, 20]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([5, 35]);
	});

	it('hands the room left over to the bars and leaves the gap where it was', () => {
		const geometry = build(two, { ...sized, bars: { width: 20, gap: 10, grow: 'bar' } });

		expect(geometry.width).toBe(120);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([50, 50]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([5, 65]);
	});

	it('hands the room left over to the gaps and keeps the bar as wide as it was asked', () => {
		const geometry = build(two, { ...sized, bars: { width: 20, gap: 10, grow: 'gap' } });

		expect(geometry.width).toBe(120);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([20, 20]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([20, 80]);
	});

	it('splits the room left over between bar and gap in the proportion it was given', () => {
		const geometry = build(two, { ...sized, bars: { width: 20, gap: 10, grow: 'both' } });

		expect(geometry.bars.map((bar) => bar.width)).toEqual([40, 40]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([10, 70]);
	});

	it('never keeps a slot the plot cannot show whole', () => {
		const points = Array.from({ length: 20 }, (_unused, index) => point(index.toString(), [1]));
		const geometry = build(points, {
			width: 155,
			bars: { width: 20, gap: 10, grow: 'none' },
		});

		expect(geometry.points).toHaveLength(5);
		expect(geometry.width).toBe(150);
		expect(geometry.slots.at(-1)?.x).toBe(120);
	});

	it('spreads the strip that is left so the last bar ends on the edge', () => {
		const points = Array.from({ length: 20 }, (_unused, index) => point(index.toString(), [1]));
		const geometry = build(points, { width: 155, bars: { width: 20, gap: 10 } });

		expect(geometry.points).toHaveLength(5);
		expect(geometry.width).toBe(155);
		expect(geometry.slots.map((slot) => slot.width)).toEqual([31, 31, 31, 31, 31]);
	});

	it('says so when a single slot is already wider than the plot', () => {
		const geometry = build(two, { width: 20, bars: { width: 20, gap: 10 } });

		expect(geometry.issue).toBe('bar-too-narrow');
		expect(geometry.points).toHaveLength(0);
		expect(geometry.bars).toHaveLength(0);
		expect(geometry.axes).toHaveLength(0);
	});

	it('treats a slot with no width at all as a bar it can never draw', () => {
		expect(build(two, { bars: { width: 0, gap: 0 } }).issue).toBe('bar-too-narrow');
	});
});

describe('bar count', () => {
	const many = Array.from({ length: 20 }, (_unused, index) => point(index.toString(), [1]));
	const twelve = many.slice(0, 12);

	it('shows no more slots than it was asked for, however many would fit', () => {
		const geometry = build(many, {
			width: 300,
			bars: { width: 20, gap: 10, count: 4, grow: 'none' },
		});

		expect(geometry.points).toHaveLength(4);
		expect(geometry.width).toBe(120);
		expect(geometry.dropped).toBe(16);
	});

	it('hands the room the missing slots leave to the bars it does show', () => {
		const geometry = build(many, {
			width: 300,
			bars: { width: 20, gap: 10, count: 4, grow: 'bar' },
		});

		expect(geometry.width).toBe(300);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([65, 65, 65, 65]);
	});

	it('drops what it cannot fit while nothing is allowed to give way', () => {
		const geometry = build(twelve, {
			width: 300,
			bars: { width: 20, gap: 10, count: 12, grow: 'none' },
		});

		expect(geometry.points).toHaveLength(10);
		expect(geometry.dropped).toBe(2);
	});

	it('narrows the gap to fit the count it was asked for and leaves the bar alone', () => {
		const geometry = build(twelve, {
			width: 300,
			bars: { width: 20, gap: 10, count: 12, grow: 'none', shrink: 'gap' },
		});

		expect(geometry.points).toHaveLength(12);
		expect(geometry.width).toBe(300);
		expect(geometry.bars.map((bar) => bar.width)).toEqual(Array<number>(12).fill(20));
	});

	it('narrows the bar to fit the count it was asked for and leaves the gap alone', () => {
		const geometry = build(twelve, {
			width: 300,
			bars: { width: 20, gap: 10, count: 12, grow: 'none', shrink: 'bar' },
		});

		expect(geometry.points).toHaveLength(12);
		expect(geometry.bars.map((bar) => bar.width)).toEqual(Array<number>(12).fill(15));
	});

	it('narrows bar and gap together in the proportion it was given', () => {
		const geometry = build(twelve, {
			width: 300,
			bars: { width: 20, gap: 10, count: 12, grow: 'none', shrink: 'both' },
		});

		expect(geometry.points).toHaveLength(12);
		expect(geometry.bars.map((bar) => bar.width)).toEqual(Array<number>(12).fill(17));
	});

	it('closes up on the points it has when the series is shorter than the count', () => {
		const geometry = build(many.slice(0, 11), {
			width: 420,
			bars: { width: 20, gap: 10, count: 14, grow: 'none' },
		});

		expect(geometry.points).toHaveLength(11);
		expect(geometry.width).toBe(330);
		expect(geometry.slots.at(-1)?.x).toBe(300);
	});

	it('holds the missing slots open at the far end when it is told to pad', () => {
		const geometry = build(many.slice(0, 11), {
			width: 420,
			bars: { width: 20, gap: 10, count: 14, pad: true, grow: 'none' },
		});

		expect(geometry.points).toHaveLength(11);
		expect(geometry.dropped).toBe(0);
		expect(geometry.width).toBe(420);
		expect(geometry.slots.at(-1)?.x).toBe(300);
	});

	it('pads the far end of a plot read backwards, which is the side it ends on', () => {
		const geometry = build(many.slice(0, 11), {
			width: 420,
			layout: { direction: 'rtl' },
			bars: { width: 20, gap: 10, count: 14, pad: true, grow: 'none' },
		});

		expect(geometry.slots[0]?.x).toBe(390);
		expect(geometry.slots.at(-1)?.x).toBe(90);
	});

	it('measures the strip it can show at once by the count it was asked for', () => {
		const geometry = build(many.slice(0, 10), {
			width: 300,
			bars: { width: 20, gap: 10, count: 5, grow: 'none' },
			overflow: { mode: 'scroll' },
		});

		expect(geometry.points).toHaveLength(10);
		expect(geometry.viewport).toBe(150);
		expect(geometry.width).toBe(300);
	});
});

describe('scrolling', () => {
	const points = Array.from({ length: 10 }, (_unused, index) => point(index.toString(), [1]));
	const scrolling: Options = {
		width: 155,
		bars: { width: 20, gap: 10 },
		overflow: { mode: 'scroll' },
	};

	it('keeps every point and paints past the edge instead of dropping', () => {
		const geometry = build(points, scrolling);

		expect(geometry.dropped).toBe(0);
		expect(geometry.points).toHaveLength(10);
		expect(geometry.width).toBe(310);
	});

	it('shows a whole number of slots, so a stop never cuts a bar in half', () => {
		const geometry = build(points, scrolling);

		expect(geometry.viewport).toBe(155);
		expect((geometry.viewport ?? 0) % 31).toBe(0);
	});

	it('measures the strip in slots of the size they were given when none may grow', () => {
		const geometry = build(points, { ...scrolling, bars: { width: 20, gap: 10, grow: 'none' } });

		expect(geometry.viewport).toBe(150);
		expect(geometry.width).toBe(300);
	});

	it('leaves the plot standing still while every point already fits', () => {
		const geometry = build(points.slice(0, 5), scrolling);

		expect(geometry.viewport).toBeNull();
		expect(geometry.dropped).toBe(0);
	});

	it('ignores the drop budget, having dropped nothing', () => {
		const geometry = build(points, {
			...scrolling,
			overflow: { mode: 'scroll', maxDropRatio: 0 },
		});

		expect(geometry.issue).toBeNull();
		expect(geometry.points).toHaveLength(10);
	});
});

describe('drop budget', () => {
	const points = Array.from({ length: 50 }, (_unused, index) => point(index.toString(), [1]));

	it('drops as much as it needs to when no budget is set', () => {
		const geometry = build(points);

		expect(geometry.issue).toBeNull();
		expect(geometry.dropped).toBe(20);
	});

	it('says so instead of drawing when it would drop more than the budget allows', () => {
		const geometry = build(points, { overflow: { maxDropRatio: 0.2 } });

		expect(geometry.issue).toBe('too-many-points');
		expect(geometry.dropped).toBe(20);
		expect(geometry.points).toHaveLength(0);
	});

	it('draws whatever fits inside the budget', () => {
		const geometry = build(points, { overflow: { maxDropRatio: 0.4 } });

		expect(geometry.issue).toBeNull();
		expect(geometry.points).toHaveLength(30);
	});

	it('never complains while every point still fits', () => {
		const geometry = build(points.slice(0, 30), { overflow: { maxDropRatio: 0 } });

		expect(geometry.issue).toBeNull();
		expect(geometry.dropped).toBe(0);
	});
});

describe('stack order', () => {
	const stacked = [point('a', [1, 3, 2])];

	function indices(overrides: Options = {}): readonly number[] {
		return (build(stacked, { width: 10, ...overrides }).bars[0]?.segments ?? []).map(
			(segment) => segment.index,
		);
	}

	it('follows the order the series came in by default', () => {
		expect(indices()).toEqual([0, 1, 2]);
	});

	it('puts the biggest at the bottom when asked to sort', () => {
		expect(indices({ bars: { order: 'descending' } })).toEqual([1, 2, 0]);
		expect(indices({ bars: { order: 'ascending' } })).toEqual([0, 2, 1]);
	});

	it('honours an explicit order of ids and appends whatever it left out', () => {
		expect(indices({ bars: { order: ['bar-2', 'bar-0'] } })).toEqual([2, 0, 1]);
	});

	it('ignores an id that no series answers to', () => {
		expect(indices({ bars: { order: ['bar-2', 'nothing'] } })).toEqual([2, 0, 1]);
	});

	it('keeps the series index on the segment, so the colour ignores the order', () => {
		const geometry = build(stacked, { width: 10, bars: { order: 'descending' } });
		const [first] = geometry.bars[0]?.segments ?? [];

		expect(first).toEqual({ index: 1, y: 50, height: 50 });
	});
});

describe('overlaid bars', () => {
	const narrow: Options = { width: 10, bars: { stack: 'overlay' } };

	it('measures against the tallest single series instead of the total', () => {
		const geometry = build([point('a', [1, 3])], narrow);

		expect(geometry.barScale.max).toBe(3);
	});

	it('sits every series on the baseline, tallest first so none is hidden', () => {
		const geometry = build([point('a', [1, 3])], narrow);
		const [first, second] = geometry.bars[0]?.segments ?? [];

		expect(first).toEqual({ index: 1, y: 0, height: 100 });
		expect(second).toEqual({ index: 0, y: 67, height: 33 });
	});
});

describe('shared scale', () => {
	const mixed = [point('a', [1], [4])];

	it('measures bars and lines against the same maximum by default', () => {
		const geometry = build(mixed, { width: 10, axes: { shared: true } });

		expect(geometry.barScale.max).toBe(4);
		expect(geometry.lineScale.max).toBe(4);
		expect(geometry.bars[0]?.segments[0]?.height).toBe(25);
	});

	it('lets each side fill the height on its own when they are split', () => {
		const geometry = build(mixed, { width: 10 });

		expect(geometry.barScale.max).toBe(1);
		expect(geometry.lineScale.max).toBe(4);
		expect(geometry.bars[0]?.segments[0]?.height).toBe(100);
	});
});

describe('axes', () => {
	const mixed = [point('a', [7], [30])];

	it('rounds the maximum up to the top tick so no bar overshoots the axis', () => {
		const geometry = build(mixed, { width: 10, axes: { mode: 'bars' } });

		expect(geometry.barScale.max).toBe(8);
		expect(geometry.axes[0]?.ticks.map((tick) => tick.value)).toEqual([0, 2, 4, 6, 8]);
	});

	it('places the ticks from the baseline up', () => {
		const geometry = build(mixed, { width: 10, axes: { mode: 'bars' } });

		expect(geometry.axes[0]?.ticks.map((tick) => tick.y)).toEqual([100, 75, 50, 25, 0]);
	});

	it('gives the lines a trailing axis of their own when the scales differ', () => {
		const geometry = build(mixed, { width: 10, axes: { mode: 'both' } });

		expect(geometry.axes.map((axis) => axis.side)).toEqual(['start', 'end']);
		expect(geometry.axes[1]?.ticks.at(-1)?.value).toBe(30);
	});

	it('draws a single axis when one ruler already measures both', () => {
		const geometry = build(mixed, { width: 10, axes: { mode: 'both', shared: true } });

		expect(geometry.axes.map((axis) => axis.side)).toEqual(['start']);
		expect(geometry.barScale.max).toBe(30);
		expect(geometry.lineScale.max).toBe(30);
	});

	it('draws no axis at all when it was not asked for', () => {
		expect(build(mixed, { width: 10 }).axes).toEqual([]);
	});
});

describe('runs the axis through the zero', () => {
	it('reaches under the zero when the ticks do', () => {
		const geometry = build([point('a', [2]), point('b', [-2])], {
			width: 20,
			axes: { mode: 'bars' },
		});

		expect(geometry.axes[0]?.ticks.map((tick) => tick.value)).toEqual([-2, -1, 0, 1, 2]);
		expect(geometry.axes[0]?.ticks.map((tick) => tick.y)).toEqual([100, 75, 50, 25, 0]);
	});
});
