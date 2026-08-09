import { describe, expect, it } from 'vitest';

import { ChartPoint, buildChartGeometry } from '@app/component/activity-chart/chart-geometry';

function point(key: string, stack: readonly number[], lines: readonly number[] = []): ChartPoint {
	return { key, label: key, description: key, stack, lines };
}

const OPTIONS = { width: 300, height: 100, minSlot: 10, barRatio: 1 };

describe('buildChartGeometry', () => {
	it('keeps the newest points and drops the ones that no longer fit', () => {
		const points = Array.from({ length: 50 }, (_unused, index) =>
			point(`day-${index.toString()}`, [1]),
		);

		const geometry = buildChartGeometry(points, OPTIONS);

		expect(geometry.points).toHaveLength(30);
		expect(geometry.points[0]?.key).toBe('day-20');
		expect(geometry.points.at(-1)?.key).toBe('day-49');
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
		expect(geometry.lines[0]?.path).toBe('5.00,50.00 15.00,0.00');
		expect(geometry.lines[1]?.path).toBe('5.00,100.00 15.00,75.00');
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
	});

	it('flattens the bars when there is nothing but zeros', () => {
		const geometry = buildChartGeometry([point('a', [0, 0])], { ...OPTIONS, width: 10 });

		expect(geometry.barMax).toBe(0);
		expect(geometry.bars[0]?.segments).toEqual([]);
	});
});
