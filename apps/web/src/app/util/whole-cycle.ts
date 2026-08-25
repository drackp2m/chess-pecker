import {
	CycleItemRow,
	TrainingCycleRow,
} from '@app/repository/definition/training-schema.interface';

export function expectedCycleItems(cycle: TrainingCycleRow, setSize: number): number {
	return Math.max(cycle.expectedItems ?? 0, setSize);
}

export function isWholeCycle(
	cycle: TrainingCycleRow,
	items: readonly CycleItemRow[],
	setSize: number,
): boolean {
	const expected = expectedCycleItems(cycle, setSize);

	return 0 < expected && expected <= items.length;
}
