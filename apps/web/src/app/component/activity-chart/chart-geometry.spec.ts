import { describe, expect, it } from 'vitest';

import {
	ChartGeometryOptions,
	ChartPoint,
	buildChartGeometry,
} from '@app/component/activity-chart/chart-geometry';

function point(key: string, stack: readonly number[], lines: readonly number[] = []): ChartPoint {
	return { key, label: key, description: key, stack, lines };
}

const OPTIONS: ChartGeometryOptions = {
	width: 300,
	height: 100,
	minSlot: 10,
	minBarWidth: 4,
	barSpacing: { mode: 'ratio', size: 1 },
	axes: 'none',
	sharedScale: false,
};

describe('buildChartGeometry', () => {
	it('keeps the newest points and drops the ones that no longer fit', () => {
		const points = Array.from({ length: 50 }, (_unused, index) =>
			point(`day-${index.toString()}`, [1]),
		);

		const geometry = buildChartGeometry(points, OPTIONS);

		expect(geometry.points).toHaveLength(30);
		expect(geometry.points[0]?.key).toBe('day-20');
		expect(geometry.points.at(-1)?.key).toBe('day-49');
		expect(geometry.dropped).toBe(20);
	});

	it('lands every slot edge on a whole pixel so touching bars share it', () => {
		const points = Array.from({ length: 3 }, (_unused, index) => point(index.toString(), [1]));
		const geometry = buildChartGeometry(points, {
			...OPTIONS,
			width: 100,
			barSpacing: { mode: 'gap', size: 0 },
		});

		expect(geometry.slots.map((slot) => slot.x)).toEqual([0, 33, 67]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([0, 33, 67]);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([33, 34, 33]);
	});

	it('shares the whole width between the slots it did keep', () => {
		const geometry = buildChartGeometry([point('a', [1]), point('b', [1])], OPTIONS);

		expect(geometry.slots.map((slot) => slot.x)).toEqual([0, 150]);
		expect(geometry.slots.map((slot) => slot.center)).toEqual([75, 225]);
	});

	it('stacks the segments upwards from the baseline', () => {
		const geometry = buildChartGeometry([point('a', [1, 3])], { ...OPTIONS, width: 10 });
		const [first, second] = geometry.bars[0]?.segments ?? [];

		expect(geometry.barMax).toBe(4);
		expect(first).toEqual({ index: 0, y: 75, height: 25 });
		expect(second).toEqual({ index: 1, y: 0, height: 75 });
	});

	it('stacks on whole pixels, so one segment starts where the one below ends', () => {
		const geometry = buildChartGeometry([point('a', [1, 1, 1])], { ...OPTIONS, width: 10 });

		expect(geometry.bars[0]?.segments).toEqual([
			{ index: 0, y: 67, height: 33 },
			{ index: 1, y: 33, height: 34 },
			{ index: 2, y: 0, height: 33 },
		]);
	});

	it('leaves out the segments with nothing to show', () => {
		const geometry = buildChartGeometry([point('a', [0, 2, 0])], { ...OPTIONS, width: 10 });

		expect(geometry.bars[0]?.segments.map((segment) => segment.index)).toEqual([1]);
	});

	it('draws one line per series, centred on each slot and scaled on its own maximum', () => {
		const geometry = buildChartGeometry([point('a', [1], [2, 0]), point('b', [1], [4, 1])], {
			...OPTIONS,
			width: 20,
		});

		expect(geometry.lineMax).toBe(4);
		expect(geometry.lines[0]?.path).toBe('M 5.00 50.00 L 15.00 0.00');
		expect(geometry.lines[1]?.path).toBe('M 5.00 100.00 L 15.00 75.00');
	});

	it('takes the width and the dash of each line from the matching style', () => {
		const geometry = buildChartGeometry([point('a', [1], [2, 0]), point('b', [1], [4, 1])], {
			...OPTIONS,
			width: 20,
			lineStyles: [{ curve: 'linear', width: 3, dash: '3 3' }],
		});

		expect(geometry.lines[0]).toMatchObject({ width: 3, dash: '3 3' });
		expect(geometry.lines[1]).toMatchObject({ width: 1.5, dash: null });
	});

	it('rounds a smooth line through every vertex', () => {
		const points = [point('a', [1], [0]), point('b', [1], [2]), point('c', [1], [1])];
		const geometry = buildChartGeometry(points, {
			...OPTIONS,
			width: 30,
			lineStyles: [{ curve: 'smooth', width: 1.5, dash: null }],
		});

		expect(geometry.lines[0]?.path).toBe(
			'M 5.00 100.00 C 6.67 83.33 11.67 8.33 15.00 0.00 C 18.33 -8.33 23.33 41.67 25.00 50.00',
		);
	});

	it('keeps a smooth line flat between two equal values instead of dipping under them', () => {
		const values = [2, 0, 0, 1];
		const points = values.map((value, index) => point(index.toString(), [1], [value]));
		const geometry = buildChartGeometry(points, {
			...OPTIONS,
			width: 40,
			lineStyles: [{ curve: 'smooth', width: 1.5, dash: null }],
		});

		expect(geometry.lines[0]?.path).toContain('C 18.33 100.00 21.67 100.00 25.00 100.00');
	});

	it('thins the labels out as the slots get narrower', () => {
		const points = Array.from({ length: 30 }, (_unused, index) => point(index.toString(), [1]));

		expect(buildChartGeometry(points, { ...OPTIONS, width: 900 }).labelStep).toBe(1);
		expect(buildChartGeometry(points, { ...OPTIONS, width: 300 }).labelStep).toBe(3);
	});

	it('draws nothing at all before the container has been measured', () => {
		const geometry = buildChartGeometry([point('a', [1])], { ...OPTIONS, width: 0 });

		expect(geometry.points).toHaveLength(0);
		expect(geometry.bars).toHaveLength(0);
		expect(geometry.lines).toHaveLength(0);
		expect(geometry.issue).toBeNull();
	});

	it('flattens the bars when there is nothing but zeros', () => {
		const geometry = buildChartGeometry([point('a', [0, 0])], { ...OPTIONS, width: 10 });

		expect(geometry.barMax).toBe(0);
		expect(geometry.bars[0]?.segments).toEqual([]);
	});
});

describe('bar spacing', () => {
	const two = [point('a', [1]), point('b', [1])];

	it('takes the hole out of the slot when it is given in pixels', () => {
		const geometry = buildChartGeometry(two, {
			...OPTIONS,
			width: 100,
			barSpacing: { mode: 'gap', size: 10 },
		});

		expect(geometry.bars.map((bar) => bar.width)).toEqual([40, 40]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([5, 55]);
	});

	it('keeps the hole proportional when it is given as a ratio', () => {
		const geometry = buildChartGeometry(two, {
			...OPTIONS,
			width: 100,
			barSpacing: { mode: 'ratio', size: 0.5 },
		});

		expect(geometry.bars.map((bar) => bar.width)).toEqual([25, 25]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([12.5, 62.5]);
	});

	it('widens the slot so the ratio never eats into the bar floor', () => {
		const points = Array.from({ length: 50 }, (_unused, index) => point(index.toString(), [1]));
		const geometry = buildChartGeometry(points, {
			...OPTIONS,
			width: 200,
			minSlot: 18,
			minBarWidth: 16,
			barSpacing: { mode: 'ratio', size: 0.8 },
		});

		expect(geometry.issue).toBeNull();
		expect(geometry.points).toHaveLength(10);
		expect(geometry.bars.every((bar) => 16 === bar.width)).toBe(true);
	});

	it('drops points rather than refusing to draw when the gap widens the slot', () => {
		const geometry = buildChartGeometry(two, {
			...OPTIONS,
			width: 100,
			minBarWidth: 16,
			barSpacing: { mode: 'gap', size: 45 },
		});

		expect(geometry.issue).toBeNull();
		expect(geometry.dropped).toBe(1);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([55]);
	});

	it('says so only once a single bar at the floor is wider than the plot', () => {
		const geometry = buildChartGeometry(two, {
			...OPTIONS,
			width: 50,
			minBarWidth: 16,
			barSpacing: { mode: 'gap', size: 45 },
		});

		expect(geometry.issue).toBe('bar-too-narrow');
		expect(geometry.points).toHaveLength(0);
		expect(geometry.bars).toHaveLength(0);
		expect(geometry.axes).toHaveLength(0);
	});

	it('keeps a fixed bar at the width it was given, however wide the slot ends up', () => {
		const geometry = buildChartGeometry(two, {
			...OPTIONS,
			width: 100,
			barSpacing: { mode: 'fixed', size: 16 },
		});

		expect(geometry.slots.map((slot) => slot.width)).toEqual([50, 50]);
		expect(geometry.bars.map((bar) => bar.width)).toEqual([16, 16]);
		expect(geometry.bars.map((bar) => bar.x)).toEqual([17, 67]);
	});

	it('packs fixed bars no tighter than the slot they were promised', () => {
		const points = Array.from({ length: 50 }, (_unused, index) => point(index.toString(), [1]));
		const geometry = buildChartGeometry(points, {
			...OPTIONS,
			width: 200,
			minSlot: 20,
			barSpacing: { mode: 'fixed', size: 16 },
		});

		expect(geometry.points).toHaveLength(10);
		expect(geometry.bars.every((bar) => 16 === bar.width)).toBe(true);
	});

	it('ignores the bar floor when the width is stated outright', () => {
		const geometry = buildChartGeometry(two, {
			...OPTIONS,
			width: 100,
			minBarWidth: 40,
			barSpacing: { mode: 'fixed', size: 6 },
		});

		expect(geometry.issue).toBeNull();
		expect(geometry.bars.map((bar) => bar.width)).toEqual([6, 6]);
	});

	it('treats a ratio of zero as a bar that can never be drawn', () => {
		const geometry = buildChartGeometry(two, {
			...OPTIONS,
			barSpacing: { mode: 'ratio', size: 0 },
		});

		expect(geometry.issue).toBe('bar-too-narrow');
	});
});

describe('drop budget', () => {
	const points = Array.from({ length: 50 }, (_unused, index) => point(index.toString(), [1]));

	it('drops as much as it needs to when no budget is set', () => {
		const geometry = buildChartGeometry(points, OPTIONS);

		expect(geometry.issue).toBeNull();
		expect(geometry.dropped).toBe(20);
	});

	it('says so instead of drawing when it would drop more than the budget allows', () => {
		const geometry = buildChartGeometry(points, { ...OPTIONS, maxDropRatio: 0.2 });

		expect(geometry.issue).toBe('too-many-points');
		expect(geometry.dropped).toBe(20);
		expect(geometry.points).toHaveLength(0);
	});

	it('draws whatever fits inside the budget', () => {
		const geometry = buildChartGeometry(points, { ...OPTIONS, maxDropRatio: 0.4 });

		expect(geometry.issue).toBeNull();
		expect(geometry.points).toHaveLength(30);
	});

	it('never complains while every point still fits', () => {
		const geometry = buildChartGeometry(points.slice(0, 30), { ...OPTIONS, maxDropRatio: 0 });

		expect(geometry.issue).toBeNull();
		expect(geometry.dropped).toBe(0);
	});
});

describe('stack order', () => {
	const stacked = [point('a', [1, 3, 2])];
	const narrow = { ...OPTIONS, width: 10 };

	function indices(options: ChartGeometryOptions): readonly number[] {
		return (buildChartGeometry(stacked, options).bars[0]?.segments ?? []).map(
			(segment) => segment.index,
		);
	}

	it('follows the order the series came in by default', () => {
		expect(indices(narrow)).toEqual([0, 1, 2]);
	});

	it('puts the biggest at the bottom when asked to sort', () => {
		expect(indices({ ...narrow, stackOrder: 'descending' })).toEqual([1, 2, 0]);
		expect(indices({ ...narrow, stackOrder: 'ascending' })).toEqual([0, 2, 1]);
	});

	it('honours an explicit order and appends whatever it left out', () => {
		expect(indices({ ...narrow, stackOrder: [2, 0] })).toEqual([2, 0, 1]);
	});

	it('keeps the series index on the segment, so the colour ignores the order', () => {
		const geometry = buildChartGeometry(stacked, { ...narrow, stackOrder: 'descending' });
		const [first] = geometry.bars[0]?.segments ?? [];

		expect(first).toEqual({ index: 1, y: 50, height: 50 });
	});
});

describe('overlaid bars', () => {
	const narrow = { ...OPTIONS, width: 10, stackMode: 'overlay' } as const;

	it('measures against the tallest single series instead of the total', () => {
		const geometry = buildChartGeometry([point('a', [1, 3])], narrow);

		expect(geometry.barMax).toBe(3);
	});

	it('sits every series on the baseline, tallest first so none is hidden', () => {
		const geometry = buildChartGeometry([point('a', [1, 3])], narrow);
		const [first, second] = geometry.bars[0]?.segments ?? [];

		expect(first).toEqual({ index: 1, y: 0, height: 100 });
		expect(second).toEqual({ index: 0, y: 67, height: 33 });
	});
});

describe('shared scale', () => {
	const mixed = [point('a', [1], [4])];
	const narrow = { ...OPTIONS, width: 10 };

	it('measures bars and lines against the same maximum by default', () => {
		const geometry = buildChartGeometry(mixed, { ...narrow, sharedScale: true });

		expect(geometry.barMax).toBe(4);
		expect(geometry.lineMax).toBe(4);
		expect(geometry.bars[0]?.segments[0]?.height).toBe(25);
	});

	it('lets each side fill the height on its own when they are split', () => {
		const geometry = buildChartGeometry(mixed, narrow);

		expect(geometry.barMax).toBe(1);
		expect(geometry.lineMax).toBe(4);
		expect(geometry.bars[0]?.segments[0]?.height).toBe(100);
	});
});

describe('axes', () => {
	const mixed = [point('a', [7], [30])];
	const narrow = { ...OPTIONS, width: 10 };

	it('rounds the maximum up to the top tick so no bar overshoots the axis', () => {
		const geometry = buildChartGeometry(mixed, { ...narrow, axes: 'bars' });

		expect(geometry.barMax).toBe(8);
		expect(geometry.axes[0]?.ticks.map((tick) => tick.value)).toEqual([0, 2, 4, 6, 8]);
	});

	it('places the ticks from the baseline up', () => {
		const geometry = buildChartGeometry(mixed, { ...narrow, axes: 'bars' });

		expect(geometry.axes[0]?.ticks.map((tick) => tick.y)).toEqual([100, 75, 50, 25, 0]);
	});

	it('gives the lines a trailing axis of their own when the scales differ', () => {
		const geometry = buildChartGeometry(mixed, { ...narrow, axes: 'both' });

		expect(geometry.axes.map((axis) => axis.side)).toEqual(['start', 'end']);
		expect(geometry.axes[1]?.ticks.at(-1)?.value).toBe(30);
	});

	it('draws a single axis when one ruler already measures both', () => {
		const geometry = buildChartGeometry(mixed, { ...narrow, axes: 'both', sharedScale: true });

		expect(geometry.axes.map((axis) => axis.side)).toEqual(['start']);
		expect(geometry.barMax).toBe(30);
		expect(geometry.lineMax).toBe(30);
	});

	it('draws no axis at all when it was not asked for', () => {
		expect(buildChartGeometry(mixed, narrow).axes).toEqual([]);
	});
});
